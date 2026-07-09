import { createSignal } from 'solid-js'

export const [results, setResults] = createSignal([])
export const [status, setStatus] = createSignal('idle')
export const [errorMsg, setErrorMsg] = createSignal('')
export const [sortBy, setSortBy] = createSignal('relevance') // relevance | price_asc | price_desc | rating
export const [filterType, setFilterType] = createSignal('all') // all | Hotel | Motel | Hostel | Resort | Campground | BedAndBreakfast
export const [sceneBg, setSceneBg] = createSignal('default') // playa | montaña | ciudad | jungla | desierto | nieve | default

// Conversation history — sliding window of previous queries (max 3)
const HISTORY_MAX = 3
const INACTIVITY_MS = 5 * 60 * 1000 // 5 minutes

export const [conversationHistory, setConversationHistory] = createSignal([])

let inactivityTimer = null

function resetInactivityTimer() {
  clearTimeout(inactivityTimer)
  inactivityTimer = setTimeout(() => {
    setConversationHistory([])
  }, INACTIVITY_MS)
}

export function resetConversation() {
  clearTimeout(inactivityTimer)
  inactivityTimer = null
  setConversationHistory([])
}

// Palabras clave → escena visual
const SCENE_KEYWORDS = {
  playa:   ['playa', 'playa', 'caribe', 'cancún', 'cancun', 'maldivas', 'bali', 'seminyak', 'tropical', 'mar', 'arena', 'coral', 'buceo', 'snorkel', 'surf'],
  montaña: ['montaña', 'montañ', 'alps', 'alpes', 'chamonix', 'esquí', 'esqui', 'nieve', 'glaciar', 'patagonia', 'torres', 'machu', 'trekking', 'senderismo', 'cima', 'cumbre'],
  jungla:  ['jungla', 'selva', 'ubud', 'safari', 'serengeti', 'naturaleza', 'animales', 'sabana', 'africa', 'áfrica', 'amazonia', 'bosque', 'exótico'],
  desierto:['desierto', 'marruecos', 'marrakech', 'sahara', 'árabe', 'medina', 'souks'],
  nieve:   ['aurora', 'boreal', 'islandia', 'ártico', 'noruega', 'finlandia', 'laponia', 'polo'],
  ciudad:  ['ciudad', 'tokyo', 'tokio', 'barcelona', 'nueva york', 'manhattan', 'brooklyn', 'berlín', 'paris', 'roma', 'urbano', 'metro', 'rascacielos', 'shibuya'],
}

export function detectScene(query) {
  const q = query.toLowerCase()
  for (const [scene, keywords] of Object.entries(SCENE_KEYWORDS)) {
    if (keywords.some(k => q.includes(k))) return scene
  }
  return 'default'
}

export function filteredAndSorted() {
  let items = results()
  if (filterType() !== 'all') {
    items = items.filter(r => r.lodgingType === filterType())
  }
  const sort = sortBy()
  if (sort === 'price_asc')  return [...items].sort((a, b) => (a.pricePerNight ?? 9999) - (b.pricePerNight ?? 9999))
  if (sort === 'price_desc') return [...items].sort((a, b) => (b.pricePerNight ?? 0) - (a.pricePerNight ?? 0))
  if (sort === 'rating')     return [...items].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
  return [...items].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
}

export async function search(query) {
  if (!query.trim()) return

  const prev = conversationHistory() // capture before clearing results

  setResults([])
  setStatus('loading')
  setErrorMsg('')
  setSceneBg(detectScene(query))

  try {
    const response = await fetch('/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, site: 'localhost', prev }),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    setStatus('streaming')
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let currentEvent = null

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()

      for (const line of lines) {
        if (line.startsWith('event:')) { currentEvent = line.slice(6).trim(); continue }
        if (!line.startsWith('data:')) continue
        const raw = line.slice(5).trim()
        if (!raw || raw === '[DONE]') continue
        try {
          const data = JSON.parse(raw)
          handleSSEEvent(currentEvent, data)
        } catch { /* keepalive */ }
        currentEvent = null
      }
    }

    setResults(prev => [...prev].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)))
    setStatus('done')

    // Append to history only on success (SC-06: errors don't pollute history)
    setConversationHistory(h => [...h, query].slice(-HISTORY_MAX))
    resetInactivityTimer()
  } catch (err) {
    setErrorMsg(err.message)
    setStatus('error')
    // History and timer are NOT updated on error
  }
}

function handleSSEEvent(eventName, data) {
  if (eventName === 'result' || data.message_type === 'result') {
    const item = data.item ?? data.content?.[0]
    if (item) setResults(prev => [...prev, normalizeItem(item)])
    return
  }
  if (eventName === 'complete' || data.message_type === 'end-nlweb-response') {
    setStatus('done')
    return
  }
  if (eventName === 'error' || data.message_type === 'error') {
    setErrorMsg(data.error ?? 'Error desconocido')
    setStatus('error')
  }
}

function normalizeItem(item) {
  const s = item.schema_object ?? {}
  const addr = s.address ?? {}
  const rating = s.aggregateRating ?? {}
  const offer = s.offers ?? {}
  const amenities = s.amenityFeature ?? []

  const lodgingType = s['@type'] ?? 'Hotel'
  const roomTypes = amenities
    .filter(a => a.propertyID?.startsWith('room:'))
    .map(a => a.name)

  const priceRaw = parseFloat(offer.price)

  return {
    id: item.url?.split('/').pop() ?? Math.random().toString(36).slice(2),
    url: item.url ?? s.url ?? '#',
    name: item.name ?? s.name ?? 'Alojamiento',
    score: item.score ?? 0,
    description: item.description ?? s.description ?? '',
    image: s.image ?? null,
    city: addr.addressLocality ?? null,
    country: addr.addressCountry ?? null,
    countryName: COUNTRY_NAMES[addr.addressCountry] ?? addr.addressCountry ?? null,
    pricePerNight: isNaN(priceRaw) ? null : priceRaw,
    priceCurrency: offer.priceCurrency ?? 'EUR',
    priceDesc: offer.description ?? 'por noche',
    priceRange: s.priceRange ?? null,
    rating: rating.ratingValue ? parseFloat(rating.ratingValue) : null,
    reviewCount: rating.reviewCount ? parseInt(rating.reviewCount) : null,
    lodgingType,
    roomTypes,
    amenities: amenities
      .filter(a => a.propertyID?.startsWith('amenity:'))
      .map(a => ({ id: a.propertyID, name: a.name, value: a.value, description: a.description })),
  }
}

const COUNTRY_NAMES = {
  MX:'México', FR:'Francia', JP:'Japón', ID:'Indonesia', CL:'Chile',
  MA:'Marruecos', IS:'Islandia', ES:'España', MV:'Maldivas', PE:'Perú',
  US:'Estados Unidos', TZ:'Tanzania',
}
