import { For, Show, Switch, Match, createMemo } from 'solid-js'
import { results, status, errorMsg, filteredAndSorted, filterType, sortBy } from '../stores/search.js'
import TravelCard from './TravelCard.jsx'

export default function ResultsGrid() {
  const items = createMemo(() => filteredAndSorted())

  return (
    <section class="results-section">
      <Switch>
        <Match when={status() === 'idle'}>
          <div class="empty-state">
            <p class="empty-icon">✈️</p>
            <p>Cuéntame qué tipo de viaje buscas y te encuentro el alojamiento perfecto.</p>
            <p class="hint">Puedes buscar por destino, tipo de alojamiento, precio o experiencia.</p>
          </div>
        </Match>

        <Match when={status() === 'loading'}>
          <div class="loading-state">
            <div class="spinner" />
            <p>Buscando los mejores destinos para ti...</p>
          </div>
        </Match>

        <Match when={status() === 'streaming' || status() === 'done'}>
          <div class="results-header">
            <span class="results-count">
              {items().length} alojamiento{items().length !== 1 ? 's' : ''}
              {filterType() !== 'all' ? ` · ${filterType()}` : ''}
              {sortBy() !== 'relevance' ? ` · ordenado por ${sortBy() === 'price_asc' ? 'precio ↑' : sortBy() === 'price_desc' ? 'precio ↓' : 'valoración'}` : ''}
            </span>
            <Show when={status() === 'streaming'}>
              <span class="streaming-dot">Cargando...</span>
            </Show>
          </div>

          <Show when={items().length === 0 && status() === 'done'}>
            <p class="no-results">No hay resultados con esos filtros. Prueba a cambiar el tipo de alojamiento.</p>
          </Show>

          <div class="results-grid">
            <For each={items()}>
              {(result) => <TravelCard result={result} />}
            </For>
          </div>
        </Match>

        <Match when={status() === 'error'}>
          <div class="error-state">
            <p>Error al conectar con el servidor: {errorMsg()}</p>
            <p class="hint">Asegúrate de que el gateway está activo en localhost:3000</p>
          </div>
        </Match>
      </Switch>
    </section>
  )
}
