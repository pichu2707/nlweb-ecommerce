import { createMemo } from 'solid-js'
import SearchBar from './components/SearchBar.jsx'
import ResultsGrid from './components/ResultsGrid.jsx'
import { sceneBg } from './stores/search.js'

// Gradientes de fondo según la escena detectada en la query
const SCENE_STYLES = {
  playa:   { bg: 'linear-gradient(160deg, #0ea5e9 0%, #06b6d4 40%, #10b981 100%)', emoji: '🏖️', label: 'Playa y mar' },
  montaña: { bg: 'linear-gradient(160deg, #1e3a5f 0%, #334155 40%, #4a5568 100%)', emoji: '🏔️', label: 'Montaña y nieve' },
  jungla:  { bg: 'linear-gradient(160deg, #064e3b 0%, #065f46 40%, #166534 100%)', emoji: '🌿', label: 'Jungla y naturaleza' },
  desierto:{ bg: 'linear-gradient(160deg, #92400e 0%, #b45309 40%, #d97706 100%)', emoji: '🏜️', label: 'Desierto y cultura' },
  nieve:   { bg: 'linear-gradient(160deg, #1e293b 0%, #0f172a 40%, #312e81 100%)', emoji: '❄️', label: 'Frío y auroras' },
  ciudad:  { bg: 'linear-gradient(160deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%)', emoji: '🌆', label: 'Ciudad y cultura' },
  default: { bg: 'linear-gradient(160deg, #1e3a5f 0%, #1e40af 40%, #1d4ed8 100%)', emoji: '✈️', label: 'Viajes' },
}

export default function App() {
  const scene = createMemo(() => SCENE_STYLES[sceneBg()] ?? SCENE_STYLES.default)

  return (
    <div class="app">
      <header class="site-header" style={{ background: scene().bg }}>
        <div class="header-content">
          <div class="logo">
            <span class="logo-icon">{scene().emoji}</span>
            <div>
              <span class="logo-name">NLTravel</span>
              <span class="logo-sub">Busca con palabras, no con filtros</span>
            </div>
          </div>
          <SearchBar />
        </div>
      </header>

      <main class="main-content">
        <ResultsGrid />
      </main>

      <footer class="site-footer">
        <p>Prototipo NLWeb · Rust · SolidJS &nbsp;·&nbsp; Búsqueda semántica por lenguaje natural</p>
      </footer>
    </div>
  )
}
