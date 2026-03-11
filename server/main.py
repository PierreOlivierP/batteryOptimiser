import math
import os
import time
import logging
from fastapi import FastAPI, Depends, HTTPException, Security, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel
from typing import List
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv

load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Setup SlowAPI Limiter
limiter = Limiter(key_func=get_remote_address)

API_KEY = os.getenv("API_KEY", "dev-key-123")
API_KEY_NAME = "x-api-key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

async def get_api_key(header_api_key: str = Security(api_key_header)):
    if header_api_key == API_KEY:
        return header_api_key
    raise HTTPException(status_code=403, detail="Clé API invalide ou manquante")

class Battery(BaseModel):
    capacity: float
    maxCharge: float
    maxDischarge: float
    efficiency: float
    initialSoc: float

class Simulation(BaseModel):
    loadKwh: List[float]
    priceKwh: List[float]
    battery: Battery

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    logger.info(f"Method: {request.method} Path: {request.url.path} Status: {response.status_code} Duration: {duration:.2f}s")
    return response

def addPower(accumulatedPower, index, powerAdded):
    for i in range(index, len(accumulatedPower)):
        accumulatedPower[i] += powerAdded
    return accumulatedPower

def removePower(accumulatedPower, index, powerRemoved):
    for i in range(index, len(accumulatedPower)):
        accumulatedPower[i] -= powerRemoved
    return accumulatedPower

def simulation(simulation_data: Simulation, optimize = False):
    neededPower = []
    accumulatedPower = []
    # for the battery state (charging or not)
    batteryHourlyState = []
    batteryPower = []

    for i in range(24):
        neededPower.append(simulation_data.loadKwh[i])
        if i == 0:
            accumulatedPower.append(simulation_data.battery.initialSoc)
        else:
            accumulatedPower.append(accumulatedPower[i-1] - neededPower[i])

    # Step 1: Baseline of the battery
    cap = simulation_data.battery.capacity
    eff = simulation_data.battery.efficiency
    mc = simulation_data.battery.maxCharge
    md = simulation_data.battery.maxDischarge

    batteryHourlyState.append(True)
    batteryPower.append(simulation_data.battery.initialSoc)

    i = 1
    while i < 24:
        # step1, worst case scenario
        if batteryPower[i-1] + mc * eff < cap:
            batteryPower.append(batteryPower[i-1] + mc * eff)
            batteryHourlyState.append(True)
            accumulatedPower = addPower(accumulatedPower, i, mc * eff - simulation_data.loadKwh[i])
        else:
            batteryPower.append(cap)
            batteryHourlyState.append(True)
            accumulatedPower = addPower(accumulatedPower, i, mc * eff - simulation_data.loadKwh[i])
            
        i += 1

    #step2 optimize
    hours_by_price_desc = sorted(range(24), key=lambda i: simulation_data.priceKwh[i], reverse=True)

    for h_high in hours_by_price_desc:
        # for backtracking purposes
        prev_battery_power = batteryPower[:]
        prev_accumulated = accumulatedPower[:]

        batteryHourlyState[h_high] = False

        # recalculating, but skipping new one
        batteryPower = []
        accumulatedPower = []

        batteryPower.append(simulation_data.battery.initialSoc)
        accumulatedPower.append(simulation_data.battery.initialSoc)

        for k in range(1, 24):
            if batteryHourlyState[k]:
                accumulatedPower.append(accumulatedPower[k-1] + mc * eff - simulation_data.loadKwh[k])
                batteryPower.append(accumulatedPower[k] - accumulatedPower[k-1])
            else:
                accumulatedPower.append(accumulatedPower[k-1] - simulation_data.loadKwh[k])
                batteryPower.append(accumulatedPower[k] - accumulatedPower[k-1])

        # if the greedy didnt work we backtrack and continue
        if min(accumulatedPower) < 0:
            batteryHourlyState[h_high] = True
            batteryPower = prev_battery_power
            accumulatedPower = prev_accumulated
    
    return accumulatedPower, batteryHourlyState

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.get("/health")
@limiter.limit("5/minute")
def health(request: Request):
    return {"status": "success"}

@app.post("/optimize")
@limiter.limit("10/minute")
def optimize(request: Request, simulation_data: Simulation, api_key: str = Depends(get_api_key)):
    print(f"Received simulation data: {simulation_data}")
    
    total_cost_before = 0
    for i in range(24):
        total_cost_before += simulation_data.priceKwh[i]
    
    accumulatedPower, batteryHourlyState = simulation(simulation_data, optimize=True)

    if min(accumulatedPower) < 0:
        return {
            "status": "error",
            "message": "La capacité de la batterie n'est pas suffisante pour couvrir la charge",
            "total_cost_before": round(total_cost_before, 2)
        }

    # Calculation of metrics for the client
    charge_kw = []
    discharge_kw = []
    soc_kwh = []
    
    total_cost_after = 0
    hourly_savings = []
    
    current_soc = simulation_data.battery.initialSoc
    capacity = simulation_data.battery.capacity
    eff = simulation_data.battery.efficiency
    max_charge = simulation_data.battery.maxCharge
    max_discharge = simulation_data.battery.maxDischarge

    for i in range(24):
        soc_kwh.append(round(current_soc, 2))
        load = simulation_data.loadKwh[i]
        price = simulation_data.priceKwh[i]
        
        if batteryHourlyState[i]:
            grid_buy = min(max_charge, (capacity - current_soc) / eff if eff > 0 else 0)
            grid_save = 0
            current_soc += grid_buy * eff
        else:
            grid_save = min(max_discharge, load, current_soc * eff)
            grid_buy = 0
            current_soc -= (grid_save / eff if eff > 0 else 0)
            
        charge_kw.append(round(grid_buy, 2))
        discharge_kw.append(round(grid_save, 2))
    
    hourly_savings = []
    for i in range(24):
        if batteryHourlyState[i]:
            total_cost_after+=simulation_data.priceKwh[i]
        else:
            hourly_savings.append(i)

    savings = total_cost_before - total_cost_after

    top_3 = sorted(hourly_savings, key=lambda x: simulation_data.priceKwh[x], reverse=True)[:3]
    explanation = "Les 3 heures ayant généré le plus d'économies sont : "
    explanation += ", ".join([f"heure {h} ({round(simulation_data.priceKwh[h], 2)}$ / kWh)" for h in top_3])
    explanation += "."

    return {
        "status": "success",
        "charge_kw": charge_kw,
        "discharge_kw": discharge_kw,
        "soc_kwh": soc_kwh,
        "total_cost_before": round(total_cost_before, 2),
        "total_cost_after": round(total_cost_after, 2),
        "savings": round(savings, 2),
        "explanation": explanation,
        "message": "Baseline solution found with user logic"
    }

@app.post("/visualize")
@limiter.limit("10/minute")
def visualize(request: Request, simulation_data: Simulation, api_key: str = Depends(get_api_key)):
    print(f"Received visualization request: {simulation_data}")
    
    accumulatedPower, batteryHourlyState = simulation(simulation_data, optimize=True)

    if min(accumulatedPower) < 0:
        return {
            "status": "error",
            "message": "La capacité de la batterie n'est pas suffisante pour couvrir la charge"
        }

    hours = [f"{i}h" for i in range(24)]
    
    # Load graph
    load_graph = {
        "x": hours,
        "y": [round(val, 2) for val in simulation_data.loadKwh],
        "title": "Charge (kWh)"
    }
    
    # battery utilization graph
    dispatch_y = []
    soc_y = []
    current_soc = simulation_data.battery.initialSoc
    capacity = simulation_data.battery.capacity
    eff = simulation_data.battery.efficiency
    max_charge = simulation_data.battery.maxCharge
    max_discharge = simulation_data.battery.maxDischarge

    for i in range(24):
        soc_y.append(round(current_soc, 2))
        load = simulation_data.loadKwh[i]
        if batteryHourlyState[i]:
            grid_buy = min(max_charge, (capacity - current_soc) / eff if eff > 0 else 0)
            grid_save = 0
            current_soc += grid_buy * eff
        else:
            grid_save = min(max_discharge, load, current_soc * eff)
            grid_buy = 0
            current_soc -= (grid_save / eff if eff > 0 else 0)
        
        dispatch_y.append(round(grid_buy - grid_save, 2))
        
    dispatch_graph = {
        "x": hours,
        "y": dispatch_y,
        "title": "Dispatch (kWh)"
    }
    
    # soc graph
    soc_graph = {
        "x": hours,
        "y": soc_y,
        "title": "État de charge (SOC)"
    }

    return {
        "status": "success",
        "load_graph": load_graph,
        "dispatch_graph": dispatch_graph,
        "soc_graph": soc_graph
    }