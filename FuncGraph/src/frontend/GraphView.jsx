import { useState, useEffect, useRef, useCallback } from 'react'
import './GraphView.css'

const DEFAULTS = {
  amplitude: 1,
  frequency: 1,
  phase: 0,
  verticalShift: 0,
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
  { key: 'amplitude',     label: 'Amplitude (A)',    min: -4,   max: 4,    step: 0.1,  symbol: 'A', unit: '' },
  { key: 'frequency',     label: 'Frequência (B)',   min: 0.1,  max: 6,    step: 0.1,  symbol: 'B', unit: '' },
  { key: 'phase',         label: 'Fase (C)',         min: -Math.PI, max: Math.PI, step: 0.05, symbol: 'C', unit: ' rad' },
  { key: 'verticalShift', label: 'Deslocamento (D)', min: -4,   max: 4,    step: 0.1,  symbol: 'D', unit: '' },
]

export default function GraphView({ selectedFunction, onBack }) {
  const [params, setParams] = useState({ ...DEFAULTS })
  // Raw text while user is typing — key → string | null (null = not editing)
  const [drafts, setDrafts] = useState({})
  const [apiStatus, setApiStatus] = useState('idle') // idle | loading | success | error
  const canvasRef = useRef(null)
  const { id, label, symbol, color } = selectedFunction

  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height
    const { amplitude, frequency, phase, verticalShift } = params

    ctx.clearRect(0, 0, W, H)

    // Background grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.lineWidth = 1
    const xRange = 4 * Math.PI
    const yRange = 5
    const toX = (x) => ((x + xRange / 2) / xRange) * W
    const toY = (y) => H / 2 - (y / yRange) * (H / 2 - 20)

    // Vertical grid lines
    for (let x = -Math.PI * 2; x <= Math.PI * 2; x += Math.PI / 2) {
      ctx.beginPath()
      ctx.moveTo(toX(x), 0)
      ctx.lineTo(toX(x), H)
      ctx.stroke()
    }
    // Horizontal grid lines
    for (let y = -4; y <= 4; y++) {
      ctx.beginPath()
      ctx.moveTo(0, toY(y))
      ctx.lineTo(W, toY(y))
      ctx.stroke()
    }

    // Axes
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 1.5
    // X-axis
    ctx.beginPath()
    ctx.moveTo(0, toY(0))
    ctx.lineTo(W, toY(0))
    ctx.stroke()
    // Y-axis
    ctx.beginPath()
    ctx.moveTo(toX(0), 0)
    ctx.lineTo(toX(0), H)
    ctx.stroke()

    // Axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.font = '11px Space Mono, monospace'
    ctx.textAlign = 'center'
    const piLabels = [
      [-Math.PI * 2, '-2π'], [-Math.PI * 1.5, '-3π/2'], [-Math.PI, '-π'],
      [-Math.PI / 2, '-π/2'], [0, '0'], [Math.PI / 2, 'π/2'],
      [Math.PI, 'π'], [Math.PI * 1.5, '3π/2'], [Math.PI * 2, '2π'],
    ]
    piLabels.forEach(([xv, lbl]) => {
      ctx.fillText(lbl, toX(xv), toY(0) + 16)
    })
    ctx.textAlign = 'right'
    for (let y = -4; y <= 4; y++) {
      if (y !== 0) ctx.fillText(y, toX(0) - 6, toY(y) + 4)
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
      const x = -xRange / 2 + (i / steps) * xRange
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

      // Discontinuity detection for tan
      if (prevY !== null && Math.abs(py - prevY) > H * 0.7) {
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
  }, [params, id, color])

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

  const handleSlider = (key, value) => {
    const num = parseFloat(value)
    setParams((prev) => ({ ...prev, [key]: num }))
    // Keep draft in sync if user isn't actively typing in this field
    setDrafts((prev) => ({ ...prev, [key]: null }))
  }

  // While typing: store raw string, don't touch params yet
  const handleInputChange = (key, raw) => {
    setDrafts((prev) => ({ ...prev, [key]: raw }))
  }

  // On blur or Enter: parse, clamp, commit to params
  const handleInputCommit = (key, raw, s) => {
    setDrafts((prev) => ({ ...prev, [key]: null }))
    const num = parseFloat(raw)
    if (isNaN(num)) return
    const clamped = Math.min(s.max, Math.max(s.min, num))
    setParams((prev) => ({ ...prev, [key]: Math.round(clamped / s.step) * s.step }))
  }

  const handleReset = () => {
    setParams({ ...DEFAULTS })
    setDrafts({})
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
              const pct = ((val - s.min) / (s.max - s.min)) * 100
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
                        onBlur={(e) => handleInputCommit(s.key, e.target.value, s)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.target.blur()
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault()
                            const next = Math.min(s.max, val + s.step)
                            setParams((prev) => ({ ...prev, [s.key]: Math.round(next * 1000) / 1000 }))
                            setDrafts((prev) => ({ ...prev, [s.key]: null }))
                          } else if (e.key === 'ArrowDown') {
                            e.preventDefault()
                            const next = Math.max(s.min, val - s.step)
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
                      min={s.min}
                      max={s.max}
                      step={s.step}
                      value={val}
                      onChange={(e) => handleSlider(s.key, e.target.value)}
                      className="slider-input"
                      style={{ '--fn-color': color, '--pct': `${pct}%` }}
                    />
                  </div>
                  <div className="slider-minmax">
                    <span>{Math.round(s.min * 100) / 100}{s.unit}</span>
                    <span>{Math.round(s.max * 100) / 100}{s.unit}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <button className="reset-btn" onClick={handleReset}>
            ↺ Redefinir Padrões
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
        <div className="graph-canvas-wrap">
          <canvas ref={canvasRef} className="graph-canvas" />
          <div className="graph-label-x">x</div>
          <div className="graph-label-y">y</div>
          <div className="graph-fn-name" style={{ color }}>
            {symbol}
          </div>
        </div>
      </div>
    </div>
  )
}
