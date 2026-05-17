import { useState, useEffect, useRef, useCallback } from 'react'
import './GraphView.css'

const DEFAULTS = {
  amplitude: 1,
  frequency: 1,
  phase: 0,
  verticalShift: 0,
}

const INITIAL_LIMITS = {
  amplitude: { min: -4, max: 4, step: 0.1 },
  frequency: { min: 0.1, max: 6, step: 0.1 },
  phase: { min: -3.14, max: 3.14, step: 0.05 },
  verticalShift: { min: -4, max: 4, step: 0.1 },
}

const FORMULA_DISPLAY = {
  sin:    (p) => `f(x) = ${fmt(p.amplitude)} · sin(${fmt(p.frequency)}x ${fmtPhase(p.phase)}) ${fmtShift(p.verticalShift)}`,
  cos:    (p) => `f(x) = ${fmt(p.amplitude)} · cos(${fmt(p.frequency)}x ${fmtPhase(p.phase)}) ${fmtShift(p.verticalShift)}`,
  tan:    (p) => `f(x) = ${fmt(p.amplitude)} · tan(${fmt(p.frequency)}x ${fmtPhase(p.phase)}) ${fmtShift(p.verticalShift)}`,
  arcsin: (p) => `f(x) = ${fmt(p.amplitude)} · arcsin(${fmt(p.frequency)}x ${fmtPhase(p.phase)}) ${fmtShift(p.verticalShift)}`,
  arccos: (p) => `f(x) = ${fmt(p.amplitude)} · arccos(${fmt(p.frequency)}x ${fmtPhase(p.phase)}) ${fmtShift(p.verticalShift)}`,
  arctan: (p) => `f(x) = ${fmt(p.amplitude)} · arctan(${fmt(p.frequency)}x ${fmtPhase(p.phase)}) ${fmtShift(p.verticalShift)}`,
}

function fmt(v) {
  const r = Math.round(v * 100) / 100
  if (r === 1) return ''
  if (r === -1) return '−'
  return String(r)
}
function fmtPhase(v) {
  if (Math.abs(v) < 0.001) return ''
  return v > 0 ? `− ${Math.round(v*100)/100}` : `+ ${Math.round(Math.abs(v)*100)/100}`
}
function fmtShift(v) {
  if (Math.abs(v) < 0.001) return ''
  return v > 0 ? `+ ${Math.round(v*100)/100}` : `− ${Math.round(Math.abs(v)*100)/100}`
}

const MATH_FN = {
  sin:    (x, a, f, p, d) => a * Math.sin(f * x - p) + d,
  cos:    (x, a, f, p, d) => a * Math.cos(f * x - p) + d,
  tan:    (x, a, f, p, d) => a * Math.tan(f * x - p) + d,
  arcsin: (x, a, f, p, d) => { const v = f*x - p; return (v >= -1 && v <= 1) ? a * Math.asin(v) + d : NaN },
  arccos: (x, a, f, p, d) => { const v = f*x - p; return (v >= -1 && v <= 1) ? a * Math.acos(v) + d : NaN },
  arctan: (x, a, f, p, d) => a * Math.atan(f * x - p) + d,
}

const SLIDERS = [
  { key: 'amplitude',     label: 'Amplitude (A)',    symbol: 'A', unit: '' },
  { key: 'frequency',     label: 'Frequência (B)',   symbol: 'B', unit: '' },
  { key: 'phase',         label: 'Fase (C)',         symbol: 'C', unit: ' rad' },
  { key: 'verticalShift', label: 'Deslocamento (D)', symbol: 'D', unit: '' },
]

function getPiLabel(v) {
  const mult = v / (Math.PI / 2)
  const r = Math.round(mult)
  if (Math.abs(mult - r) > 0.01) return ''
  if (r === 0) return '0'
  
  if (r % 2 === 0) {
    const k = r / 2
    if (k === 1) return 'π'
    if (k === -1) return '-π'
    return `${k}π`
  } else {
    if (r === 1) return 'π/2'
    if (r === -1) return '-π/2'
    return `${r}π/2`
  }
}

export default function GraphView({ selectedFunction, onBack }) {
  const [params, setParams] = useState({ ...DEFAULTS })
  const [limits, setLimits] = useState({ ...INITIAL_LIMITS })
  const [drafts, setDrafts] = useState({})
  const [apiStatus, setApiStatus] = useState('idle')
  
  // Zoom e Pan States
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)

  const canvasRef = useRef(null)
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const panStartRef = useRef({ x: 0, y: 0 })

  const { id, label, symbol, color } = selectedFunction

  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height
    const { amplitude, frequency, phase, verticalShift } = params

    ctx.clearRect(0, 0, W, H)

    // Viewport transforms
    const xRangeBase = 4 * Math.PI
    const yRangeBase = 5

    const scaleX = (W / xRangeBase) * zoom
    const scaleY = ((H / 2 - 20) / yRangeBase) * zoom

    const centerX = W / 2 + pan.x
    const centerY = H / 2 + pan.y

    const toX = (x) => centerX + x * scaleX
    const toY = (y) => centerY - y * scaleY

    const fromX = (px) => (px - centerX) / scaleX
    const fromY = (py) => (centerY - py) / scaleY

    const xMinVis = fromX(0)
    const xMaxVis = fromX(W)
    const yMinVis = fromY(H)
    const yMaxVis = fromY(0)

    // Background grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.lineWidth = 1

    // Vertical grid lines (multiples of pi/2)
    const stepX = Math.PI / 2
    const firstX = Math.ceil(xMinVis / stepX) * stepX
    const lastX = Math.floor(xMaxVis / stepX) * stepX

    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.font = '11px Space Mono, monospace'

    for (let x = firstX; x <= lastX; x += stepX) {
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(toX(x), 0)
      ctx.lineTo(toX(x), H)
      ctx.stroke()

      const lbl = getPiLabel(x)
      if (lbl) {
        ctx.textAlign = 'center'
        let labelY = toY(0) + 16
        if (labelY < 16) labelY = 16
        if (labelY > H - 8) labelY = H - 8
        ctx.fillText(lbl, toX(x), labelY)
      }
    }

    // Horizontal grid lines
    const stepY = 1
    const firstY = Math.ceil(yMinVis / stepY) * stepY
    const lastY = Math.floor(yMaxVis / stepY) * stepY

    ctx.textAlign = 'right'
    for (let y = firstY; y <= lastY; y += stepY) {
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, toY(y))
      ctx.lineTo(W, toY(y))
      ctx.stroke()

      if (Math.abs(y) > 0.001 || toX(0) < 0 || toX(0) > W) {
        let labelX = toX(0) - 6
        if (labelX < 24) labelX = 24
        if (labelX > W - 12) labelX = W - 12
        ctx.fillText(Math.round(y * 100) / 100, labelX, toY(y) + 4)
      }
    }

    // Axes
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 1.5
    // X-axis
    if (toY(0) >= 0 && toY(0) <= H) {
      ctx.beginPath()
      ctx.moveTo(0, toY(0))
      ctx.lineTo(W, toY(0))
      ctx.stroke()
    }
    // Y-axis
    if (toX(0) >= 0 && toX(0) <= W) {
      ctx.beginPath()
      ctx.moveTo(toX(0), 0)
      ctx.lineTo(toX(0), H)
      ctx.stroke()
    }

    // Function curve
    const fn = MATH_FN[id]
    ctx.strokeStyle = color
    ctx.lineWidth = 2.5
    ctx.shadowColor = color
    ctx.shadowBlur = 8
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    const steps = W * 2
    let started = false
    let prevY = null

    ctx.beginPath()
    for (let i = 0; i <= steps; i++) {
      const x = xMinVis + (i / steps) * (xMaxVis - xMinVis)
      const y = fn(x, amplitude, frequency, phase, verticalShift)

      if (!isFinite(y) || isNaN(y)) {
        started = false
        prevY = null
        ctx.stroke()
        ctx.beginPath()
        continue
      }

      const px = toX(x)
      const py = toY(y)

      if (prevY !== null && Math.abs(py - prevY) > H * 1.5) {
        ctx.stroke()
        ctx.beginPath()
        started = false
      }

      if (!started) {
        ctx.moveTo(px, py)
        started = true
      } else {
        ctx.lineTo(px, py)
      }
      prevY = py
    }
    ctx.stroke()
    ctx.shadowBlur = 0
  }, [params, id, color, zoom, pan])

  useEffect(() => {
    drawGraph()
  }, [drawGraph])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      const rect = canvas.parentElement.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
      drawGraph()
    })
    ro.observe(canvas.parentElement)
    return () => ro.disconnect()
  }, [drawGraph])

  // Mouse wheel zoom event hook
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleWheel = (e) => {
      e.preventDefault()
      const zoomFactor = 1.15
      if (e.deltaY < 0) {
        setZoom(z => Math.min(50, z * zoomFactor))
      } else {
        setZoom(z => Math.max(0.05, z / zoomFactor))
      }
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [])

  const handleSlider = (key, value) => {
    const num = parseFloat(value)
    setParams((prev) => ({ ...prev, [key]: num }))
    setDrafts((prev) => ({ ...prev, [key]: null }))
  }

  const handleInputChange = (key, raw) => {
    setDrafts((prev) => ({ ...prev, [key]: raw }))
  }

  const handleInputCommit = (key, raw, s) => {
    setDrafts((prev) => ({ ...prev, [key]: null }))
    const num = parseFloat(raw)
    if (isNaN(num)) return
    const currentMin = limits[key].min
    const currentMax = limits[key].max
    const currentStep = limits[key].step
    const clamped = Math.min(currentMax, Math.max(currentMin, num))
    setParams((prev) => ({ ...prev, [key]: Math.round(clamped / currentStep) * currentStep }))
  }

  const handleLimitChange = (key, type, value) => {
    const num = parseFloat(value)
    if (isNaN(num)) return
    setLimits((prev) => ({
      ...prev,
      [key]: { ...prev[key], [type]: num }
    }))
  }

  const handleReset = () => {
    setParams({ ...DEFAULTS })
    setDrafts({})
    setLimits({ ...INITIAL_LIMITS })
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  // Pointer drag for panning
  const handlePointerDown = (e) => {
    isDraggingRef.current = true
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    panStartRef.current = { ...pan }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return
    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    setPan({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy
    })
  }

  const handlePointerUp = (e) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false
      setIsDragging(false)
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const handleSendToBackend = async () => {
    setApiStatus('loading')
    try {
      const payload = {
        function: id,
        params: { ...params },
      }
      const res = await fetch('/api/graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setApiStatus('success')
      setTimeout(() => setApiStatus('idle'), 2500)
    } catch {
      setApiStatus('error')
      setTimeout(() => setApiStatus('idle'), 2500)
    }
  }

  const formula = FORMULA_DISPLAY[id]?.(params) ?? ''

  return (
    <div className="graph-page">
      <div className="graph-bg">
        <div className="graph-grid" />
        <div className="fn-glow-bg" style={{ '--fn-color': color }} />
      </div>

      {/* Top Bar */}
      <header className="graph-header">
        <button className="back-btn" onClick={onBack}>
          <span className="back-arrow">←</span>
          <span>Voltar</span>
        </button>

        <div className="fn-badge" style={{ '--fn-color': color }}>
          <span className="fn-badge-dot" />
          <span className="fn-badge-label">{label}</span>
          <span className="fn-badge-sym">{symbol}</span>
        </div>

        <button
          className={`send-btn ${apiStatus}`}
          onClick={handleSendToBackend}
          disabled={apiStatus === 'loading'}
        >
          {apiStatus === 'idle' && '↑ Enviar ao Servidor'}
          {apiStatus === 'loading' && '● Enviando…'}
          {apiStatus === 'success' && '✓ Enviado!'}
          {apiStatus === 'error' && '✗ Erro na conexão'}
        </button>
      </header>

      {/* Main Layout */}
      <div className="graph-body">
        {/* Sidebar */}
        <aside className="params-panel">
          <div className="params-title">
            <span className="params-icon">⚙</span>
            Parâmetros
          </div>

          <div className="formula-box" style={{ '--fn-color': color }}>
            <span className="formula-label">Fórmula</span>
            <span className="formula-text">{formula || `f(x) = ${id}(x)`}</span>
          </div>

          <div className="sliders-list">
            {SLIDERS.map((s) => {
              const val = params[s.key]
              const currentMin = limits[s.key].min
              const currentMax = limits[s.key].max
              const currentStep = limits[s.key].step

              const pct = Math.min(100, Math.max(0, ((val - currentMin) / (currentMax - currentMin)) * 100))
              const isDrafting = drafts[s.key] != null
              const displayVal = isDrafting
                ? drafts[s.key]
                : String(Math.round(val * 100) / 100)

              return (
                <div className="slider-item" key={s.key}>
                  <div className="slider-header">
                    <label className="slider-label" htmlFor={`input-${s.key}`}>
                      {s.label}
                    </label>
                    <div className="value-input-wrap" style={{ '--fn-color': color }}>
                      <input
                        id={`input-${s.key}`}
                        type="text"
                        inputMode="decimal"
                        className={`value-input ${isDrafting ? 'is-drafting' : ''}`}
                        value={displayVal}
                        onChange={(e) => handleInputChange(s.key, e.target.value)}
                        onBlur={(e) => handleInputCommit(s.key, e.target.value, limits[s.key])}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.target.blur()
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault()
                            const next = Math.min(currentMax, val + currentStep)
                            setParams((prev) => ({ ...prev, [s.key]: Math.round(next * 1000) / 1000 }))
                            setDrafts((prev) => ({ ...prev, [s.key]: null }))
                          } else if (e.key === 'ArrowDown') {
                            e.preventDefault()
                            const next = Math.max(currentMin, val - currentStep)
                            setParams((prev) => ({ ...prev, [s.key]: Math.round(next * 1000) / 1000 }))
                            setDrafts((prev) => ({ ...prev, [s.key]: null }))
                          }
                        }}
                        onFocus={(e) => {
                          e.target.select()
                          setDrafts((prev) => ({ ...prev, [s.key]: displayVal }))
                        }}
                        style={{ '--fn-color': color }}
                      />
                      {s.unit && <span className="value-unit">{s.unit.trim()}</span>}
                    </div>
                  </div>
                  <div className="slider-track-wrap">
                    <input
                      type="range"
                      min={currentMin}
                      max={currentMax}
                      step={currentStep}
                      value={val}
                      onChange={(e) => handleSlider(s.key, e.target.value)}
                      className="slider-input"
                      style={{ '--fn-color': color, '--pct': `${pct}%` }}
                    />
                  </div>
                  
                  {/* Limites Editáveis */}
                  <div className="slider-minmax editable-limits">
                    <div className="limit-field">
                      <span>Mín:</span>
                      <input 
                        type="number" 
                        value={Math.round(currentMin * 100) / 100}
                        step={currentStep}
                        onChange={(e) => handleLimitChange(s.key, 'min', e.target.value)}
                        className="limit-input"
                      />
                    </div>
                    <div className="limit-field">
                      <span>Máx:</span>
                      <input 
                        type="number" 
                        value={Math.round(currentMax * 100) / 100}
                        step={currentStep}
                        onChange={(e) => handleLimitChange(s.key, 'max', e.target.value)}
                        className="limit-input"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <button className="reset-btn" onClick={handleReset}>
            ↺ Redefinir Tudo
          </button>

          <div className="info-box">
            <div className="info-row">
              <span className="info-key">Período</span>
              <span className="info-val" style={{ '--fn-color': color }}>
                {id === 'tan'
                  ? `π/${Math.round(params.frequency * 100) / 100}`
                  : `2π/${Math.round(params.frequency * 100) / 100}`}
              </span>
            </div>
            <div className="info-row">
              <span className="info-key">Amplitude</span>
              <span className="info-val" style={{ '--fn-color': color }}>
                {['arcsin','arccos','arctan'].includes(id) ? '—' : Math.abs(params.amplitude)}
              </span>
            </div>
            <div className="info-row">
              <span className="info-key">Fase</span>
              <span className="info-val" style={{ '--fn-color': color }}>
                {Math.round(params.phase * 100) / 100} rad
              </span>
            </div>
          </div>
        </aside>

        {/* Graph canvas */}
        <div 
          className={`graph-canvas-wrap ${isDragging ? 'grabbing' : 'grab'}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <canvas ref={canvasRef} className="graph-canvas" />
          <div className="graph-label-x">x</div>
          <div className="graph-label-y">y</div>
          <div className="graph-fn-name" style={{ color }}>
            {symbol}
          </div>

          {/* Botões de Zoom integrados */}
          <div className="zoom-controls">
            <button className="zoom-btn" onClick={() => setZoom(z => Math.min(50, z * 1.25))} title="Aumentar Zoom">+</button>
            <button className="zoom-btn" onClick={() => setZoom(z => Math.max(0.05, z / 1.25))} title="Diminuir Zoom">−</button>
            <button className="zoom-btn reset-view" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title="Centralizar Gráfico">⌂</button>
          </div>
        </div>
      </div>
    </div>
  )
}
