import { useState, useEffect, useRef, useCallback } from 'react'
import './GraphView.css'

// F(X) = A + B * fn(C*x + D)
// A = Deslocamento vertical
// B = Amplitude
// C = Frequência
// D = Fase

const DEFAULTS = {
  verticalShift: 0,
  amplitude: 1,
  frequency: 1,
  phase: 0,
}

const INITIAL_LIMITS = {
  verticalShift: { min: -4, max: 4, step: 0.1 },
  amplitude:     { min: -4, max: 4, step: 0.1 },
  frequency:     { min: 0.1, max: 6, step: 0.1 },
  phase:         { min: -3.14, max: 3.14, step: 0.05 },
}

const FORMULA_DISPLAY = {
  sin:    (p) => `f(x) = ${fmtA(p.verticalShift)}${fmtB(p.amplitude)}sen(${fmtC(p.frequency)}x${fmtD(p.phase)})`,
  cos:    (p) => `f(x) = ${fmtA(p.verticalShift)}${fmtB(p.amplitude)}cos(${fmtC(p.frequency)}x${fmtD(p.phase)})`,
  tan:    (p) => `f(x) = ${fmtA(p.verticalShift)}${fmtB(p.amplitude)}tan(${fmtC(p.frequency)}x${fmtD(p.phase)})`,
  arcsin: (p) => `f(x) = ${fmtA(p.verticalShift)}${fmtB(p.amplitude)}arcsen(${fmtC(p.frequency)}x${fmtD(p.phase)})`,
  arccos: (p) => `f(x) = ${fmtA(p.verticalShift)}${fmtB(p.amplitude)}arccos(${fmtC(p.frequency)}x${fmtD(p.phase)})`,
  arctan: (p) => `f(x) = ${fmtA(p.verticalShift)}${fmtB(p.amplitude)}arctan(${fmtC(p.frequency)}x${fmtD(p.phase)})`,
}

function r(v) { return Math.round(v * 100) / 100 }
function fmtA(v) {
  if (Math.abs(v) < 0.001) return ''
  return v >= 0 ? `${r(v)} + ` : `${r(v)} + `
}
function fmtB(v) {
  const rv = r(v)
  if (rv === 1) return ''
  if (rv === -1) return '−'
  return `${rv}·`
}
function fmtC(v) {
  const rv = r(v)
  if (rv === 1) return ''
  return String(rv)
}
function fmtD(v) {
  if (Math.abs(v) < 0.001) return ''
  return v > 0 ? ` + ${r(v)}` : ` − ${r(Math.abs(v))}`
}

const MATH_FN = {
  sin:    (x, a, b, c, d) => a + b * Math.sin(c * x + d),
  cos:    (x, a, b, c, d) => a + b * Math.cos(c * x + d),
  tan:    (x, a, b, c, d) => a + b * Math.tan(c * x + d),
  arcsin: (x, a, b, c, d) => { const v = c*x + d; return (v >= -1 && v <= 1) ? a + b * Math.asin(v) : NaN },
  arccos: (x, a, b, c, d) => { const v = c*x + d; return (v >= -1 && v <= 1) ? a + b * Math.acos(v) : NaN },
  arctan: (x, a, b, c, d) => a + b * Math.atan(c * x + d),
}

// Período de cada função
function getPeriod(id, frequency) {
  const f = Math.abs(frequency) < 0.001 ? 0.001 : frequency
  if (id === 'tan') return Math.PI / f
  if (id === 'arcsin' || id === 'arccos') return 2 / f
  return (2 * Math.PI) / f
}

const SLIDERS = [
  { key: 'verticalShift', label: 'A — Deslocamento', symbol: 'A', unit: '' },
  { key: 'amplitude',     label: 'B — Amplitude',    symbol: 'B', unit: '' },
  { key: 'frequency',     label: 'C — Frequência',   symbol: 'C', unit: '' },
  { key: 'phase',         label: 'D — Fase',         symbol: 'D', unit: 'rad' },
]

const COMPARISON_COLORS = [
  '#ffd166', '#06d6a0', '#ef476f', '#a78bfa', '#f4a261', '#48cae4',
]
const COMPARISON_DASHES = [
  [10, 5], [5, 5], [15, 4, 4, 4], [7, 3], [12, 6], [4, 4],
]

function getPiLabel(v) {
  const mult = v / (Math.PI / 2)
  const r2 = Math.round(mult)
  if (Math.abs(mult - r2) > 0.01) return ''
  if (r2 === 0) return '0'
  if (r2 % 2 === 0) {
    const k = r2 / 2
    if (k === 1) return 'π'
    if (k === -1) return '-π'
    return `${k}π`
  } else {
    if (r2 === 1) return 'π/2'
    if (r2 === -1) return '-π/2'
    return `${r2}π/2`
  }
}

function buildFormula(id, p) {
  return FORMULA_DISPLAY[id]?.(p) ?? `f(x) = ${id}(x)`
}

// Quadrant display modes
const VIEW_MODES = [
  { id: 'full',    label: 'Visão Completa',  icon: '⊞', desc: 'Todos os quadrantes' },
  { id: 'period',  label: 'Um Período',      icon: '⊡', desc: 'Foco em 1 período' },
  { id: 'custom',  label: 'Intervalo Livre', icon: '⊟', desc: 'Defina o intervalo' },
]

export default function GraphView({ selectedFunction, onBack }) {
  const [params, setParams] = useState({ ...DEFAULTS })
  const [limits, setLimits] = useState({ ...INITIAL_LIMITS })
  const [drafts, setDrafts] = useState({})
  const [apiStatus, setApiStatus] = useState('idle')

  // Comparison
  const [comparisons, setComparisons] = useState([])
  const [legendCollapsed, setLegendCollapsed] = useState(false)

  // View mode
  const [viewMode, setViewMode] = useState('full')
  const [customXMin, setCustomXMin] = useState(-2 * Math.PI)
  const [customXMax, setCustomXMax] = useState(2 * Math.PI)
  const [customYMin, setCustomYMin] = useState(-4)
  const [customYMax, setCustomYMax] = useState(4)
  const [quadrantDrafts, setQuadrantDrafts] = useState({})

  // Zoom & Pan (used in full/custom mode)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)

  const canvasRef = useRef(null)
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const panStartRef = useRef({ x: 0, y: 0 })

  const { id, label, symbol, color } = selectedFunction

  // Compute viewport bounds based on viewMode
  const getViewport = useCallback((W, H) => {
    if (viewMode === 'period') {
      const period = getPeriod(id, params.frequency)
      const phaseShift = -params.phase / params.frequency
      const xMin = phaseShift
      const xMax = phaseShift + period
      const amp = Math.abs(params.amplitude)
      const yPad = amp * 0.35 + 0.5
      const yCenter = params.verticalShift
      const yMin = yCenter - amp - yPad
      const yMax = yCenter + amp + yPad
      const xRange = xMax - xMin
      const yRange = yMax - yMin
      const scaleX = W / xRange
      const scaleY = H / yRange
      const toX = (x) => (x - xMin) * scaleX
      const toY = (y) => H - (y - yMin) * scaleY
      const fromX = (px) => px / scaleX + xMin
      const fromY = (py) => (H - py) / scaleY + yMin
      return { scaleX, scaleY, toX, toY, fromX, fromY, xMinVis: xMin, xMaxVis: xMax, yMinVis: yMin, yMaxVis: yMax }
    }
    if (viewMode === 'custom') {
      const xRange = customXMax - customXMin || 1
      const yRange = customYMax - customYMin || 1
      const scaleX = W / xRange
      const scaleY = H / yRange
      const toX = (x) => (x - customXMin) * scaleX
      const toY = (y) => H - (y - customYMin) * scaleY
      const fromX = (px) => px / scaleX + customXMin
      const fromY = (py) => (H - py) / scaleY + customYMin
      return { scaleX, scaleY, toX, toY, fromX, fromY, xMinVis: customXMin, xMaxVis: customXMax, yMinVis: customYMin, yMaxVis: customYMax }
    }
    // 'full' — use zoom/pan
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
    return { scaleX, scaleY, toX, toY, fromX, fromY, xMinVis: fromX(0), xMaxVis: fromX(W), yMinVis: fromY(H), yMaxVis: fromY(0) }
  }, [viewMode, zoom, pan, params, id, customXMin, customXMax, customYMin, customYMax])

  const drawCurve = useCallback((ctx, fnId, p, W, H, vp, strokeColor, dashPattern, alpha = 1) => {
    const { toX, toY, xMinVis, xMaxVis } = vp
    const fn = MATH_FN[fnId]
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = dashPattern ? 2.5 : 3.5
    ctx.shadowColor = strokeColor
    ctx.shadowBlur = dashPattern ? 6 : 12
    ctx.globalAlpha = alpha
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.setLineDash(dashPattern || [])

    const steps = W * 2
    let started = false
    let prevY = null
    ctx.beginPath()
    for (let i = 0; i <= steps; i++) {
      const x = xMinVis + (i / steps) * (xMaxVis - xMinVis)
      const y = fn(x, p.verticalShift, p.amplitude, p.frequency, p.phase)
      if (!isFinite(y) || isNaN(y)) {
        started = false; prevY = null
        ctx.stroke(); ctx.beginPath(); continue
      }
      const px = toX(x)
      const py = toY(y)
      if (prevY !== null && Math.abs(py - prevY) > H * 1.5) {
        ctx.stroke(); ctx.beginPath(); started = false
      }
      if (!started) { ctx.moveTo(px, py); started = true }
      else { ctx.lineTo(px, py) }
      prevY = py
    }
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
    ctx.setLineDash([])
  }, [])

  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)

    const vp = getViewport(W, H)
    const { toX, toY, xMinVis, xMaxVis, yMinVis, yMaxVis } = vp

    // Period mode: draw shaded period background
    if (viewMode === 'period') {
      ctx.fillStyle = 'rgba(255,255,255,0.015)'
      ctx.fillRect(0, 0, W, H)
      // subtle frame
      ctx.strokeStyle = `${color}33`
      ctx.lineWidth = 2
      ctx.strokeRect(1, 1, W - 2, H - 2)
    }

    // Grid lines
    const xRange = xMaxVis - xMinVis
    const yRange = yMaxVis - yMinVis

    // Choose smart step for X
    let stepX = Math.PI / 2
    if (xRange > 20 * Math.PI) stepX = 2 * Math.PI
    else if (xRange > 8 * Math.PI) stepX = Math.PI
    else if (xRange < Math.PI) stepX = Math.PI / 4
    // For custom mode, use numeric steps
    if (viewMode === 'custom') {
      stepX = Math.pow(10, Math.floor(Math.log10(xRange / 5)))
    }

    let stepY = 1
    if (yRange > 20) stepY = 5
    else if (yRange > 10) stepY = 2
    else if (yRange < 2) stepY = 0.5

    ctx.font = 'bold 14px Space Mono, monospace'
    ctx.fillStyle = 'rgba(255,255,255,0.5)'

    // Vertical grid lines
    const firstX = Math.ceil(xMinVis / stepX) * stepX
    for (let x = firstX; x <= xMaxVis + stepX * 0.01; x += stepX) {
      const px = toX(x)
      if (px < -2 || px > W + 2) continue
      ctx.strokeStyle = 'rgba(255,255,255,0.07)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke()

      // Label
      let lbl = ''
      if (viewMode !== 'custom') {
        lbl = getPiLabel(x)
      } else {
        lbl = String(Math.round(x * 10) / 10)
      }
      if (lbl) {
        ctx.textAlign = 'center'
        const yAxis = toY(0)
        let labelY = Math.min(H - 10, Math.max(20, yAxis + 20))
        ctx.fillText(lbl, px, labelY)
      }
    }

    // Horizontal grid lines
    const firstY = Math.ceil(yMinVis / stepY) * stepY
    ctx.textAlign = 'right'
    for (let y = firstY; y <= yMaxVis + stepY * 0.01; y += stepY) {
      const py = toY(y)
      if (py < -2 || py > H + 2) continue
      ctx.strokeStyle = 'rgba(255,255,255,0.07)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(W, py); ctx.stroke()

      if (Math.abs(y) > 0.001 * stepY || viewMode !== 'full') {
        const xAxis = toX(0)
        let labelX = Math.min(W - 8, Math.max(30, xAxis - 8))
        ctx.fillText(Math.round(y * 100) / 100, labelX, py + 5)
      }
    }

    // Axes
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'
    ctx.lineWidth = 2
    // X-axis
    const yAxisPx = toY(0)
    if (yAxisPx >= 0 && yAxisPx <= H) {
      ctx.beginPath(); ctx.moveTo(0, yAxisPx); ctx.lineTo(W, yAxisPx); ctx.stroke()
    }
    // Y-axis
    const xAxisPx = toX(0)
    if (xAxisPx >= 0 && xAxisPx <= W) {
      ctx.beginPath(); ctx.moveTo(xAxisPx, 0); ctx.lineTo(xAxisPx, H); ctx.stroke()
    }

    // In period mode: draw period markers
    if (viewMode === 'period') {
      const period = getPeriod(id, params.frequency)
      const phaseShift = -params.phase / params.frequency
      const x0 = toX(phaseShift)
      const x1 = toX(phaseShift + period)
      // vertical boundary lines
      ctx.strokeStyle = `${color}66`
      ctx.lineWidth = 1.5
      ctx.setLineDash([6, 4])
      ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0, H); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, H); ctx.stroke()
      ctx.setLineDash([])
      // period label
      ctx.fillStyle = color
      ctx.font = 'bold 13px Space Mono, monospace'
      ctx.textAlign = 'center'
      const midX = (x0 + x1) / 2
      ctx.fillText(`T = ${Math.round(period * 100) / 100}`, midX, 22)
    }

    // Draw comparison curves (behind main)
    comparisons.forEach((comp) => {
      if (!comp.visible) return
      drawCurve(ctx, comp.fnId, comp.params, W, H, vp, comp.color, comp.dash, 0.7)
    })

    // Draw main curve
    drawCurve(ctx, id, params, W, H, vp, color, null, 1)

  }, [params, id, color, zoom, pan, comparisons, drawCurve, viewMode, getViewport, customXMin, customXMax, customYMin, customYMax])

  useEffect(() => { drawGraph() }, [drawGraph])

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

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const handleWheel = (e) => {
      if (viewMode !== 'full') return
      e.preventDefault()
      const zf = 1.15
      if (e.deltaY < 0) setZoom(z => Math.min(50, z * zf))
      else setZoom(z => Math.max(0.05, z / zf))
    }
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [viewMode])

  const handleSlider = (key, value) => {
    setParams((prev) => ({ ...prev, [key]: parseFloat(value) }))
    setDrafts((prev) => ({ ...prev, [key]: null }))
  }
  const handleInputChange = (key, raw) => setDrafts((prev) => ({ ...prev, [key]: raw }))
  const handleInputCommit = (key, raw) => {
    setDrafts((prev) => ({ ...prev, [key]: null }))
    const num = parseFloat(raw)
    if (isNaN(num)) return
    const { min, max, step } = limits[key]
    const clamped = Math.min(max, Math.max(min, num))
    setParams((prev) => ({ ...prev, [key]: Math.round(clamped / step) * step }))
  }
  const handleLimitChange = (key, type, value) => {
    const num = parseFloat(value)
    if (isNaN(num)) return
    setLimits((prev) => ({ ...prev, [key]: { ...prev[key], [type]: num } }))
  }
  const handleReset = () => {
    setParams({ ...DEFAULTS })
    setDrafts({})
    setLimits({ ...INITIAL_LIMITS })
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setViewMode('full')
    setCustomXMin(-2 * Math.PI)
    setCustomXMax(2 * Math.PI)
    setCustomYMin(-4)
    setCustomYMax(4)
  }

  const handleAddComparison = () => {
    const idx = comparisons.length
    setComparisons((prev) => [...prev, {
      id: Date.now(),
      fnId: id,
      params: { ...params },
      color: COMPARISON_COLORS[idx % COMPARISON_COLORS.length],
      dash: COMPARISON_DASHES[idx % COMPARISON_DASHES.length],
      visible: true,
    }])
  }
  const handleRemoveComparison = (cid) => setComparisons((prev) => prev.filter(c => c.id !== cid))
  const handleToggleComparison = (cid) => setComparisons((prev) => prev.map(c => c.id === cid ? { ...c, visible: !c.visible } : c))
  const handleClearComparisons = () => setComparisons([])

  const handlePointerDown = (e) => {
    if (viewMode !== 'full') return
    isDraggingRef.current = true
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    panStartRef.current = { ...pan }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return
    setPan({ x: panStartRef.current.x + e.clientX - dragStartRef.current.x, y: panStartRef.current.y + e.clientY - dragStartRef.current.y })
  }
  const handlePointerUp = (e) => {
    if (isDraggingRef.current) { isDraggingRef.current = false; setIsDragging(false); e.currentTarget.releasePointerCapture(e.pointerId) }
  }

  const handleSendToBackend = async () => {
    setApiStatus('loading')
    try {
      const res = await fetch('/api/graph', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ function: id, params }) })
      if (!res.ok) throw new Error()
      setApiStatus('success')
      setTimeout(() => setApiStatus('idle'), 2500)
    } catch { setApiStatus('error'); setTimeout(() => setApiStatus('idle'), 2500) }
  }

  const formula = buildFormula(id, params)
  const period = getPeriod(id, params.frequency)

  const qDraft = (key) => quadrantDrafts[key] ?? ''
  const qVal = (key, fallback) => quadrantDrafts[key] !== undefined ? quadrantDrafts[key] : fallback
  const commitQuadrant = (key, setter, raw) => {
    const num = parseFloat(raw)
    if (!isNaN(num)) setter(num)
    setQuadrantDrafts(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  return (
    <div className="graph-page">
      <div className="graph-bg">
        <div className="graph-grid" />
        <div className="fn-glow-bg" style={{ '--fn-color': color }} />
      </div>

      {/* ── TOP BAR ── */}
      <header className="graph-header">
        <button className="back-btn" onClick={onBack}>
          <span>←</span> Voltar
        </button>

        <div className="fn-badge" style={{ '--fn-color': color }}>
          <span className="fn-badge-dot" />
          <span className="fn-badge-label">{label}</span>
          <span className="fn-badge-sym">{symbol}</span>
        </div>

        <div className="header-actions">
          <button className="compare-btn" onClick={handleAddComparison}>
            + Comparar
          </button>
          <button className={`send-btn ${apiStatus}`} onClick={handleSendToBackend} disabled={apiStatus === 'loading'}>
            {apiStatus === 'idle' && '↑ Enviar'}
            {apiStatus === 'loading' && '● …'}
            {apiStatus === 'success' && '✓ Ok'}
            {apiStatus === 'error' && '✗ Erro'}
          </button>
        </div>
      </header>

      {/* ── BODY ── */}
      <div className="graph-body">

        {/* ── SIDEBAR ── */}
        <aside className="params-panel">

          {/* Formula geral */}
          <div className="formula-box" style={{ '--fn-color': color }}>
            <div className="formula-general">F(x) = A + B · fn(C·x + D)</div>
            <div className="formula-divider" />
            <div className="formula-current">{formula}</div>
          </div>

          {/* Sliders */}
          <div className="sliders-list">
            {SLIDERS.map((s) => {
              const val = params[s.key]
              const { min: cMin, max: cMax, step: cStep } = limits[s.key]
              const pct = Math.min(100, Math.max(0, ((val - cMin) / (cMax - cMin)) * 100))
              const isDrafting = drafts[s.key] != null
              const displayVal = isDrafting ? drafts[s.key] : String(Math.round(val * 100) / 100)

              return (
                <div className="slider-item" key={s.key}>
                  <div className="slider-header">
                    <label className="slider-label">{s.label}</label>
                    <div className="value-input-wrap" style={{ '--fn-color': color }}>
                      <input
                        type="text" inputMode="decimal"
                        className={`value-input ${isDrafting ? 'is-drafting' : ''}`}
                        value={displayVal}
                        onChange={(e) => handleInputChange(s.key, e.target.value)}
                        onBlur={(e) => handleInputCommit(s.key, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.target.blur()
                          else if (e.key === 'ArrowUp') { e.preventDefault(); setParams(p => ({ ...p, [s.key]: Math.round(Math.min(cMax, val + cStep) * 1000) / 1000 })); setDrafts(d => ({ ...d, [s.key]: null })) }
                          else if (e.key === 'ArrowDown') { e.preventDefault(); setParams(p => ({ ...p, [s.key]: Math.round(Math.max(cMin, val - cStep) * 1000) / 1000 })); setDrafts(d => ({ ...d, [s.key]: null })) }
                        }}
                        onFocus={(e) => { e.target.select(); setDrafts(d => ({ ...d, [s.key]: displayVal })) }}
                        style={{ '--fn-color': color }}
                      />
                      {s.unit && <span className="value-unit">{s.unit}</span>}
                    </div>
                  </div>
                  <input
                    type="range" min={cMin} max={cMax} step={cStep} value={val}
                    onChange={(e) => handleSlider(s.key, e.target.value)}
                    className="slider-input"
                    style={{ '--fn-color': color, '--pct': `${pct}%` }}
                  />
                  <div className="slider-minmax">
                    <div className="limit-field">
                      <span>Mín</span>
                      <input type="number" value={Math.round(cMin * 100) / 100} step={cStep}
                        onChange={(e) => handleLimitChange(s.key, 'min', e.target.value)}
                        className="limit-input" />
                    </div>
                    <div className="limit-field">
                      <span>Máx</span>
                      <input type="number" value={Math.round(cMax * 100) / 100} step={cStep}
                        onChange={(e) => handleLimitChange(s.key, 'max', e.target.value)}
                        className="limit-input" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Info rápida */}
          <div className="info-box">
            <div className="info-row">
              <span className="info-key">Período</span>
              <span className="info-val" style={{ color }}>{Math.round(period * 100) / 100}</span>
            </div>
            <div className="info-row">
              <span className="info-key">|Amplitude|</span>
              <span className="info-val" style={{ color }}>
                {['arcsin','arccos','arctan'].includes(id) ? '—' : Math.abs(params.amplitude)}
              </span>
            </div>
            <div className="info-row">
              <span className="info-key">Fase (rad)</span>
              <span className="info-val" style={{ color }}>{Math.round(params.phase * 100) / 100}</span>
            </div>
          </div>

          <button className="reset-btn" onClick={handleReset}>↺ Redefinir Tudo</button>
        </aside>

        {/* ── RIGHT SIDE ── */}
        <div className="graph-right">

          {/* VIEW MODE BAR */}
          <div className="view-mode-bar">
            <div className="view-mode-tabs">
              {VIEW_MODES.map(vm => (
                <button
                  key={vm.id}
                  className={`view-tab ${viewMode === vm.id ? 'active' : ''}`}
                  onClick={() => setViewMode(vm.id)}
                  style={viewMode === vm.id ? { '--tab-color': color } : {}}
                >
                  <span className="view-tab-icon">{vm.icon}</span>
                  <span className="view-tab-label">{vm.label}</span>
                  <span className="view-tab-desc">{vm.desc}</span>
                </button>
              ))}
            </div>

            {/* Custom interval controls */}
            {viewMode === 'custom' && (
              <div className="custom-interval">
                <span className="interval-group-label">Eixo X</span>
                <div className="interval-field">
                  <span>de</span>
                  <input type="text" inputMode="decimal" className="interval-input"
                    value={quadrantDrafts['xMin'] !== undefined ? quadrantDrafts['xMin'] : Math.round(customXMin * 100) / 100}
                    onChange={e => setQuadrantDrafts(p => ({ ...p, xMin: e.target.value }))}
                    onBlur={e => commitQuadrant('xMin', setCustomXMin, e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                  />
                </div>
                <div className="interval-field">
                  <span>até</span>
                  <input type="text" inputMode="decimal" className="interval-input"
                    value={quadrantDrafts['xMax'] !== undefined ? quadrantDrafts['xMax'] : Math.round(customXMax * 100) / 100}
                    onChange={e => setQuadrantDrafts(p => ({ ...p, xMax: e.target.value }))}
                    onBlur={e => commitQuadrant('xMax', setCustomXMax, e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                  />
                </div>
                <span className="interval-sep">|</span>
                <span className="interval-group-label">Eixo Y</span>
                <div className="interval-field">
                  <span>de</span>
                  <input type="text" inputMode="decimal" className="interval-input"
                    value={quadrantDrafts['yMin'] !== undefined ? quadrantDrafts['yMin'] : Math.round(customYMin * 100) / 100}
                    onChange={e => setQuadrantDrafts(p => ({ ...p, yMin: e.target.value }))}
                    onBlur={e => commitQuadrant('yMin', setCustomYMin, e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                  />
                </div>
                <div className="interval-field">
                  <span>até</span>
                  <input type="text" inputMode="decimal" className="interval-input"
                    value={quadrantDrafts['yMax'] !== undefined ? quadrantDrafts['yMax'] : Math.round(customYMax * 100) / 100}
                    onChange={e => setQuadrantDrafts(p => ({ ...p, yMax: e.target.value }))}
                    onBlur={e => commitQuadrant('yMax', setCustomYMax, e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                  />
                </div>
              </div>
            )}

            {/* Period info */}
            {viewMode === 'period' && (
              <div className="period-info-bar">
                <span className="period-pill" style={{ '--fn-color': color }}>
                  T = {Math.round(period * 100) / 100}
                </span>
                <span className="period-desc">Exibindo exatamente 1 período completo da função atual</span>
              </div>
            )}
          </div>

          {/* LEGEND */}
          {comparisons.length > 0 && (
            <div className={`legend-panel ${legendCollapsed ? 'collapsed' : ''}`}>
              <div className="legend-header">
                <span className="legend-title">◈ Comparativo</span>
                <div className="legend-header-actions">
                  <button className="legend-clear-btn" onClick={handleClearComparisons}>✕ Limpar</button>
                  <button className="legend-collapse-btn" onClick={() => setLegendCollapsed(v => !v)}>
                    {legendCollapsed ? '▼' : '▲'}
                  </button>
                </div>
              </div>
              {!legendCollapsed && (
                <div className="legend-list">
                  {/* current fn */}
                  <div className="legend-item current-fn">
                    <svg width="40" height="16" viewBox="0 0 40 16">
                      <line x1="0" y1="8" x2="40" y2="8" stroke={color} strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    <span className="legend-fn-text" style={{ color }}>{formula}</span>
                    <span className="legend-tag">atual</span>
                  </div>
                  {comparisons.map((comp, idx) => (
                    <div key={comp.id} className={`legend-item ${!comp.visible ? 'hidden-fn' : ''}`}>
                      <button className="legend-vis-btn" onClick={() => handleToggleComparison(comp.id)}
                        style={{ color: comp.visible ? comp.color : 'rgba(255,255,255,0.2)' }}>
                        {comp.visible ? '◉' : '○'}
                      </button>
                      <svg width="40" height="16" viewBox="0 0 40 16">
                        <line x1="0" y1="8" x2="40" y2="8" stroke={comp.color} strokeWidth="2.5"
                          strokeLinecap="round" strokeDasharray={comp.dash.join(' ')}
                          opacity={comp.visible ? 1 : 0.3} />
                      </svg>
                      <span className="legend-fn-text" style={{ color: comp.visible ? comp.color : 'rgba(255,255,255,0.25)' }}>
                        f{idx + 1}(x) — {buildFormula(comp.fnId, comp.params)}
                      </span>
                      <button className="legend-remove-btn" onClick={() => handleRemoveComparison(comp.id)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CANVAS */}
          <div
            className={`graph-canvas-wrap ${viewMode === 'full' ? (isDragging ? 'grabbing' : 'grab') : ''}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <canvas ref={canvasRef} className="graph-canvas" />
            <div className="graph-label-x">x</div>
            <div className="graph-label-y">y</div>
            <div className="graph-fn-name" style={{ color }}>{symbol}</div>

            {viewMode === 'full' && (
              <div className="zoom-controls">
                <button className="zoom-btn" onClick={() => setZoom(z => Math.min(50, z * 1.25))}>+</button>
                <button className="zoom-btn" onClick={() => setZoom(z => Math.max(0.05, z / 1.25))}>−</button>
                <button className="zoom-btn reset-view" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}>⌂</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
