import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { WebProvider, useWeb } from './contexts/WebContext'
import Plot from 'react-plotly.js'

function AppContent() {
  const { health, optimize, visualize } = useWeb()

  const [batteryData, setBatteryData] = useState({
    capacity: 10,
    maxCharge: 5,
    maxDischarge: 5,
    efficiency: 0.9,
    initialSoc: 5,
    loadKwH: [2, 2, 1, 2, 3, 2, 1, 2, 3, 2, 2, 2, 1, 2, 3, 2, 2, 1, 2, 3, 2, 2, 2, 1],
    priceKwH: [3, 12, 7, 0, 15, 9, 2, 6, 14, 5, 8, 1, 11, 4, 10, 7, 13, 2, 6, 0, 9, 5, 8, 12]
  })

  const [loadMode, setLoadMode] = useState('hourly')
  const [priceMode, setPriceMode] = useState('hourly')
  const [hourlyLoad, setHourlyLoad] = useState([2, 2, 1, 2, 3, 2, 1, 2, 3, 2, 2, 2, 1, 2, 3, 2, 2, 1, 2, 3, 2, 2, 2, 1])
  const [hourlyPrice, setHourlyPrice] = useState([3, 12, 7, 0, 15, 9, 2, 6, 14, 5, 8, 1, 11, 4, 10, 7, 13, 2, 6, 0, 9, 5, 8, 12])
  const [visualizationData, setVisualizationData] = useState(null)
  const [optimizationResult, setOptimizationResult] = useState(null)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setBatteryData({
      ...batteryData,
      [name]: parseFloat(value) || 0
    });
  };

  const handleHourlyChange = (index, value, setter, currentArray) => {
    const newArray = [...currentArray];
    newArray[index] = parseFloat(value) || 0;
    setter(newArray);
  };

  const handleOptimize = async () => {
    setError(null);
    setSuccessMessage(null);
    const finalData = {
      ...batteryData,
      loadKwH: loadMode === 'fixed' ? batteryData.loadKwH : hourlyLoad,
      priceKwh: priceMode === 'fixed' ? batteryData.priceKwH : hourlyPrice,
      loadMode,
      priceMode
    };
    try {
      const response = await optimize(finalData);
      if (response && response.status === 'success') {
        setOptimizationResult(response);
        setVisualizationData(null);
        setError(null);
      } else {
        setError(response?.message || "Les chiffres ne fonctionnent pas");
        setOptimizationResult(null);
        setVisualizationData(null);
      }
    } catch (err) {
      setError("Erreur de communication avec le serveur");
      setOptimizationResult(null);
      setVisualizationData(null);
    }
  };

  const handleVisualize = async () => {
    setError(null);
    setSuccessMessage(null);
    const finalData = {
      ...batteryData,
      loadKwH: loadMode === 'fixed' ? batteryData.loadKwH : hourlyLoad,
      priceKwH: priceMode === 'fixed' ? batteryData.priceKwH : hourlyPrice,
      loadMode,
      priceMode
    };
    try {
      const data = await visualize(finalData);
      if (data && data.status === 'success') {
        setVisualizationData(data);
        setOptimizationResult(null);
        setError(null);
      } else {
        setError(data?.message || "Les chiffres ne fonctionnent pas");
        setVisualizationData(null);
        setOptimizationResult(null);
      }
    } catch (err) {
      setError("Erreur de communication avec le serveur");
      setVisualizationData(null);
      setOptimizationResult(null);
    }
  };

  const handleHealth = async () => {
    setError(null);
    setSuccessMessage(null);
    try {
      const data = await health();
      if (data && data.status === 'success') {
        setSuccessMessage("Le système est en parfaite santé et prêt à simuler !");
      }
    } catch (err) {
      setError("Le serveur ne fonctionne pas");
      setVisualizationData(null);
      setOptimizationResult(null);
    }
  };

  return (
    <>
      <h1>Optimisateur de batterie</h1>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center', padding: '20px' }}>
        <div className="card" style={{ textAlign: 'left', minWidth: '400px', flex: '1' }}>
          <h3>Paramètres de la batterie</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
            <div><label>Capacité: </label><input type="number" name="capacity" value={batteryData.capacity} onChange={handleInputChange} /></div>
            <div><label>Charge: </label><input type="number" name="maxCharge" value={batteryData.maxCharge} onChange={handleInputChange} /></div>
            <div><label>Décharge: </label><input type="number" name="maxDischarge" value={batteryData.maxDischarge} onChange={handleInputChange} /></div>
            <div><label>Efficacité (0-1): </label><input type="number" name="efficiency" step="0.01" value={batteryData.efficiency} onChange={handleInputChange} /></div>
            <div><label>État de charge initial: </label><input type="number" name="initialSoc" value={batteryData.initialSoc} onChange={handleInputChange} /></div>
          </div>

          <h3>Données de simulation</h3>

          <div style={{ marginBottom: '15px', borderBottom: '1px solid #444', paddingBottom: '10px' }}>
            <label><strong>Données de charge:</strong> </label>
            <select value={loadMode} onChange={(e) => setLoadMode(e.target.value)}>
              <option value="fixed">Prix fixe</option>
              <option value="hourly">Prix par heure (24 values)</option>
            </select>
            {loadMode === 'fixed' ? (
              <div style={{ marginTop: '5px' }}>
                <label>Charge fixe (kWh): </label>
                <input type="number" name="loadKwH" value={batteryData.loadKwH} onChange={handleInputChange} />
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '5px', marginTop: '10px' }}>
                {hourlyLoad.map((val, i) => (
                  <div key={i}><small>H{i}:</small><input type="number" style={{ width: '40px' }} value={val} onChange={(e) => handleHourlyChange(i, e.target.value, setHourlyLoad, hourlyLoad)} /></div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label><strong>Price Data:</strong> </label>
            <select value={priceMode} onChange={(e) => setPriceMode(e.target.value)}>
              <option value="fixed">Fixed Price</option>
              <option value="hourly">Charge par heure</option>
            </select>
            {priceMode === 'fixed' ? (
              <div style={{ marginTop: '5px' }}>
                <label>Fixed Price ($/kWh): </label>
                <input type="number" name="priceKwH" value={batteryData.priceKwH} onChange={handleInputChange} />
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '5px', marginTop: '10px' }}>
                {hourlyPrice.map((val, i) => (
                  <div key={i}><small>H{i}:</small><input type="number" style={{ width: '40px' }} value={val} onChange={(e) => handleHourlyChange(i, e.target.value, setHourlyPrice, hourlyPrice)} /></div>
                ))}
              </div>
            )}
          </div>

          <button onClick={handleOptimize} style={{ marginTop: '10px', width: '100%', padding: '10px' }}>Simuler l'optimisation</button>
          <button onClick={handleVisualize} style={{ marginTop: '10px', width: '100%', padding: '10px' }}>Visualiser l'optimisation</button>
          <button onClick={handleHealth} style={{ marginTop: '10px', width: '100%', padding: '10px' }}>Vérifier si le système est en santé</button>
        </div>

        {(visualizationData || optimizationResult || error || successMessage) && (
          <div style={{ flex: '2', minWidth: '600px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {error && (
              <div className="card" style={{ padding: '20px', border: '2px solid #ff4444', background: '#301515' }}>
                <h3 style={{ color: '#ff4444', marginTop: 0 }}>Désolé, les chiffres ne fonctionnent pas</h3>
                <p>{error}</p>
              </div>
            )}

            {successMessage && (
              <div className="card" style={{ padding: '20px', border: '2px solid #4caf50', background: '#1b2e1b' }}>
                <h3 style={{ color: '#4caf50', marginTop: 0 }}>Succès !</h3>
                <p>{successMessage}</p>
              </div>
            )}

            {optimizationResult && (
              <div className="card" style={{ padding: '20px', textAlign: 'left' }}>
                <h3>Résultats de la Simulation</h3>

                <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '20px', border: '1px solid #444', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '14px' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#242424' }}>
                      <tr style={{ borderBottom: '2px solid #646cff' }}>
                        <th style={{ padding: '10px' }}>Heure</th>
                        <th style={{ padding: '10px' }}>Charge (kW)</th>
                        <th style={{ padding: '10px' }}>Décharge (kW)</th>
                        <th style={{ padding: '10px' }}>SOC (kWh)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 24 }).map((_, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #333' }}>
                          <td style={{ padding: '8px' }}>{i}h</td>
                          <td style={{ padding: '8px' }}>{optimizationResult.charge_kw[i]?.toFixed(2)}</td>
                          <td style={{ padding: '8px' }}>{optimizationResult.discharge_kw[i]?.toFixed(2)}</td>
                          <td style={{ padding: '8px' }}>{optimizationResult.soc_kwh[i]?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ padding: '15px', background: '#1a1a1a', borderRadius: '8px', borderLeft: '4px solid #646cff' }}>
                  <h4 style={{ marginTop: 0 }}>Résumé</h4>
                  <p><strong>Cout initial:</strong> {optimizationResult.total_cost_before}$</p>
                  <p><strong>Cout après:</strong> {optimizationResult.total_cost_after}$</p>
                  <p style={{ color: '#4caf50', fontSize: '1.1em' }}><strong>Économies:</strong> {optimizationResult.savings}$</p>
                  <hr style={{ borderColor: '#444' }} />
                  <p style={{ fontStyle: 'italic', color: '#ccc' }}>{optimizationResult.explanation}</p>
                  <small style={{ color: '#888' }}>{optimizationResult.message}</small>
                </div>
              </div>
            )}

            {visualizationData && (
              <>
                <div className="card" style={{ padding: '10px' }}>
                  <h4>{visualizationData.load_graph.title}</h4>
                  <Plot
                    data={[
                      {
                        x: visualizationData.load_graph.x,
                        y: visualizationData.load_graph.y,
                        type: 'scatter',
                        mode: 'lines+markers',
                        name: 'Load',
                        line: { color: '#646cff' },
                      },
                    ]}
                    layout={{ paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: '#fff' }, margin: { t: 20, b: 40, l: 40, r: 20 } }}
                    useResizeHandler={true}
                    style={{ width: '100%', height: '300px' }}
                  />
                </div>
                <div className="card" style={{ padding: '10px' }}>
                  <h4>{visualizationData.battery_utilization_graph?.title || visualizationData.dispatch_graph?.title}</h4>
                  <Plot
                    data={[
                      {
                        x: visualizationData.dispatch_graph.x,
                        y: visualizationData.dispatch_graph.y,
                        type: 'bar',
                        name: 'Dispatch',
                        marker: {
                          color: visualizationData.dispatch_graph.y.map(val => val >= 0 ? '#4caf50' : '#f44336')
                        },
                      },
                    ]}
                    layout={{ paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: '#fff' }, margin: { t: 20, b: 40, l: 40, r: 20 } }}
                    useResizeHandler={true}
                    style={{ width: '100%', height: '300px' }}
                  />
                </div>
                <div className="card" style={{ padding: '10px' }}>
                  <h4>{visualizationData.state_of_charge_graph?.title || visualizationData.soc_graph?.title}</h4>
                  <Plot
                    data={[
                      {
                        x: visualizationData.soc_graph.x,
                        y: visualizationData.soc_graph.y,
                        type: 'scatter',
                        mode: 'lines',
                        fill: 'tozeroy',
                        name: 'SOC',
                        line: { color: '#ff9800' },
                      },
                    ]}
                    layout={{ paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: '#fff' }, margin: { t: 20, b: 40, l: 40, r: 20 } }}
                    useResizeHandler={true}
                    style={{ width: '100%', height: '300px' }}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function App() {
  return (
    <WebProvider>
      <AppContent />
    </WebProvider>
  )
}

export default App
