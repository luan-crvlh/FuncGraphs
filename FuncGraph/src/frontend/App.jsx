import { useState } from 'react'
import FunctionSelector from './FunctionSelector'
import GraphView from './GraphView'
import './App.css'

function App() {
  const [selectedFunction, setSelectedFunction] = useState(null)

  const handleSelect = (fn) => {
    setSelectedFunction(fn)
  }

  const handleBack = () => {
    setSelectedFunction(null)
  }

  return (
    <div id="app-root">
      {selectedFunction === null ? (
        <FunctionSelector onSelect={handleSelect} />
      ) : (
        <GraphView selectedFunction={selectedFunction} onBack={handleBack} />
      )}
    </div>
  )
}

export default App
