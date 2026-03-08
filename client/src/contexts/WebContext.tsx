import axios from 'axios';
import React, { createContext, useContext, useState, ReactNode } from 'react';

const API_KEY = "dev-key-123";
// const API_BASE_URL = "https://battery-optimizer.com"; // when it goes to production
const API_BASE_URL = "http://localhost:8000";

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'x-api-key': API_KEY
  }
});

export interface Web {
  id: number;
  name: string;
  email: string;
}

interface WebContextType {
  health: () => Promise<any>;
  optimize: (batteryData: any) => Promise<any>;
  visualize: (batteryData: any) => Promise<any>;
}

const WebContext = createContext<WebContextType | undefined>(undefined);

export const WebProvider: React.FC<{ children: ReactNode }> = ({ children }) => {

  const health = async () => {
    try {
      const response = await axiosInstance.get('/health');
      console.log('Health check:', response.data);
      return response.data;
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  };

  const optimize = async (batteryData: any) => {
    const ensureHourly = (data: any) => {
      if (Array.isArray(data)) return data;
      return Array(24).fill(data);
    };

    const simulationData = {
      battery: {
        capacity: batteryData.capacity,
        maxCharge: batteryData.maxCharge,
        maxDischarge: batteryData.maxDischarge,
        efficiency: batteryData.efficiency,
        initialSoc: batteryData.initialSoc,
      },
      loadKwh: ensureHourly(batteryData.loadKwH),
      priceKwh: ensureHourly(batteryData.priceKwH)
    };

    try {
      const response = await axiosInstance.post('/optimize', simulationData);

      return response.data;
    } catch (error) {
      console.error('Optimization failed:', error);
      throw error;
    }
  }

  const visualize = async (batteryData: any) => {
    const ensureHourly = (data: any) => {
      if (Array.isArray(data)) return data;
      return Array(24).fill(data);
    };

    const simulationData = {
      battery: {
        capacity: batteryData.capacity,
        maxCharge: batteryData.maxCharge,
        maxDischarge: batteryData.maxDischarge,
        efficiency: batteryData.efficiency,
        initialSoc: batteryData.initialSoc,
      },
      loadKwh: ensureHourly(batteryData.loadKwH),
      priceKwh: ensureHourly(batteryData.priceKwH)
    };

    try {
      const response = await axiosInstance.post('/visualize', simulationData);

      return response.data;
    } catch (error) {
      console.error('visualize failed:', error);
      throw error;
    }
  }

  return (
    <WebContext.Provider value={{ health, optimize, visualize }}>
      {children}
    </WebContext.Provider>
  );
};

export const useWeb = () => {
  const context = useContext(WebContext);
  if (context === undefined) {
    throw new Error('useWeb must be used within a WebProvider');
  }
  return context;
};
