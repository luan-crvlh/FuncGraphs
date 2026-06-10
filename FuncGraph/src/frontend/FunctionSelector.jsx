import { useState } from 'react'
import './FunctionSelector.css'

const FUNCTIONS = [
  {
    id: 'sin',
    label: 'Seno',
    symbol: 'sin(x)',
    color: '#00f5d4',
    description: 'Função periódica fundamental — oscila entre −1 e 1',
    wave: 'M0,25 C15,0 35,0 50,25 C65,50 85,50 100,25',
  },
  {
    id: 'cos',
    label: 'Cosseno',
    symbol: 'cos(x)',
    color: '#ff6b6b',
    description: 'Irmã do seno — defasada em π/2',
    wave: 'M0,0 C15,0 35,50 50,25 C65,0 85,50 100,25',
  },
  {
    id: 'tan',
    label: 'Tangente',
    symbol: 'tan(x)',
    color: '#ffd166',
    description: 'Diverge em π/2 — assíntotas verticais',
    wave: 'M0,48 C10,45 18,30 25,10 M35,48 C45,45 53,30 60,10 M70,48 C80,45 88,30 95,10',
  },
  {
    id: 'arcsin',
    label: 'Arco Seno',
    symbol: 'arcsin(x)',
    color: '#06d6a0',
    description: 'Inversa do seno — domínio [−1, 1]',
    wave: 'M10,45 C20,40 30,30 50,25 C70,20 80,10 90,5',
  },
  {
    id: 'arccos',
    label: 'Arco Cosseno',
    symbol: 'arccos(x)',
    color: '#ef476f',
    description: 'Inversa do cosseno — decrescente em [−1, 1]',
    wave: 'M10,5 C20,10 30,20 50,25 C70,30 80,40 90,45',
  },
  {
    id: 'arctan',
    label: 'Arco Tangente',
    symbol: 'arctan(x)',
    color: '#f4a261',
    description: 'Inversa da tangente — limitada entre −π/2 e π/2',
    wave: 'M5,45 C15,43 25,35 50,25 C75,15 85,7 95,5',
  },
]

export default function FunctionSelector({ onSelect }) {
  const [hovered, setHovered] = useState(null)

  return (
    <div className="selector-page">
      <div className="selector-bg">
        <div className="grid-overlay" />
        <div className="glow glow-1" />
        <div className="glow glow-2" />
        <div className="glow glow-3" />
      </div>

      <header className="selector-header">
        <div className="logo-area">
          <span className="logo-icon"><img src="./32x32.png"></img></span>
          <span className="logo-text">Matemática Com Café - Funções Trigonométricas</span>
        </div>
        <p className="selector-subtitle">
          Explorador Interativo de Funções Trigonométricas
        </p>
      </header>

      <main className="selector-main">
        <h1 className="selector-title">
          Escolha uma <span className="highlight">função</span> para explorar
        </h1>
        <p className="selector-desc">
          Selecione e ajuste os parâmetros em tempo real para visualizar o comportamento do gráfico
        </p>

        <div className="cards-grid">
          {FUNCTIONS.map((fn, i) => (
            <button
              key={fn.id}
              className={`fn-card ${hovered === fn.id ? 'is-hovered' : ''}`}
              style={{ '--fn-color': fn.color, '--delay': `${i * 0.07}s` }}
              onMouseEnter={() => setHovered(fn.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelect(fn)}
            >
              <div className="card-glow" />
              <div className="card-top">
                <span className="fn-symbol">{fn.symbol}</span>
                <svg className="fn-wave" viewBox="0 0 100 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d={fn.wave} stroke={fn.color} strokeWidth="2.5" strokeLinecap="round" fill="none" />
                </svg>
              </div>
              <div className="card-bottom">
                <h2 className="fn-label">{fn.label}</h2>
                <p className="fn-desc">{fn.description}</p>
              </div>
              <div className="card-arrow">→</div>
            </button>
          ))}
        </div>
      </main>

      <footer className="selector-footer">
        <span>Desenvolvido para fins educacionais</span>
      </footer>
    </div>
  )
}
