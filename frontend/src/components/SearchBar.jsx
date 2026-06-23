import { createSignal } from 'solid-js'
import { Show, For } from 'solid-js'
import { search, status, setSortBy, setFilterType, sortBy, filterType, conversationHistory, resetConversation } from '../stores/search.js'

const truncate = (text) => text.length > 40 ? text.slice(0, 40) + '…' : text

function ConversationChips() {
  return (
    <Show when={conversationHistory().length > 0}>
      <div class="conversation-chips">
        <For each={conversationHistory()}>
          {(q) => <span class="chip">{truncate(q)}</span>}
        </For>
        <button type="button" class="chip chip--reset" onClick={resetConversation}>
          Nueva búsqueda
        </button>
      </div>
    </Show>
  )
}

const SUGGESTIONS = [
  'Playas de Cancún económico',
  'Hotel de montaña para esquiar',
  'Hostal en Tokyo barato',
  'Resort de lujo en Maldivas',
  'Safari en África todo incluido',
  'Aurora boreal en Islandia',
  'Habitación doble en Barcelona',
  'Lodge en la Patagonia',
]

export default function SearchBar() {
  const [query, setQuery] = createSignal('')
  const [showSuggestions, setShowSuggestions] = createSignal(false)
  const isSearching = () => status() === 'loading' || status() === 'streaming'

  const handleSubmit = (e) => {
    e.preventDefault()
    if (query().trim()) {
      setShowSuggestions(false)
      search(query())
    }
  }

  const useSuggestion = (s) => {
    setQuery(s)
    setShowSuggestions(false)
    search(s)
  }

  return (
    <div class="search-wrapper">
      <ConversationChips />
      <form class="search-bar" onSubmit={handleSubmit}>
        <div class="search-input-wrap">
          <span class="search-icon">✦</span>
          <input
            type="text"
            placeholder="¿A dónde quieres ir? Cuéntame qué buscas..."
            value={query()}
            onInput={e => setQuery(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            disabled={isSearching()}
            autofocus
          />
        </div>
        <button type="submit" disabled={isSearching()}>
          {isSearching() ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {showSuggestions() && (
        <ul class="suggestions">
          {SUGGESTIONS.map(s => (
            <li onClick={() => useSuggestion(s)}>{s}</li>
          ))}
        </ul>
      )}

      {(status() === 'streaming' || status() === 'done') && (
        <div class="filters-row">
          <div class="filter-group">
            <label>Tipo</label>
            <select value={filterType()} onChange={e => setFilterType(e.target.value)}>
              <option value="all">Todos</option>
              <option value="Hotel">Hotel</option>
              <option value="Hostal">Hostal</option>
              <option value="Resort">Resort</option>
              <option value="Lodge">Lodge</option>
              <option value="Camping">Camping</option>
              <option value="Glamping">Glamping</option>
              <option value="Riad">Riad</option>
              <option value="Chalet">Chalet</option>
              <option value="Hotel Cápsula">Cápsula</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Ordenar</label>
            <select value={sortBy()} onChange={e => setSortBy(e.target.value)}>
              <option value="relevance">Relevancia</option>
              <option value="price_asc">Precio: menor primero</option>
              <option value="price_desc">Precio: mayor primero</option>
              <option value="rating">Mejor valorado</option>
            </select>
          </div>
        </div>
      )}
    </div>
  )
}
