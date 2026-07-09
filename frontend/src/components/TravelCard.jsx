import { Show, For } from 'solid-js'

const TYPE_EMOJI = {
  'Hotel': '🏨', 'Motel': '🛣️', 'Hostel': '🏠',
  'Resort': '🌴', 'Campground': '⛺', 'BedAndBreakfast': '🏡',
}

const TYPE_LABEL = {
  'Hotel': 'Hotel', 'Motel': 'Motel', 'Hostel': 'Hostal',
  'Resort': 'Resort', 'Campground': 'Camping', 'BedAndBreakfast': 'Casa rural',
}

const PRICE_LABEL = { '€': 'Económico', '€€': 'Precio medio', '€€€': 'Superior', '€€€€': 'Lujo' }

function Stars({ rating }) {
  const full = Math.round(rating)
  return (
    <span class="stars" aria-label={`${rating} de 5`}>
      {'★'.repeat(full)}{'☆'.repeat(5 - full)}
    </span>
  )
}

export default function TravelCard({ result }) {
  const priceFormatted = () =>
    result.pricePerNight != null
      ? `${result.pricePerNight.toFixed(0)} ${result.priceCurrency}`
      : result.priceRange ?? '—'

  const emoji = () => TYPE_EMOJI[result.lodgingType] ?? '🏨'

  return (
    <article class="travel-card">
      <div class="card-image-wrap">
        <Show
          when={result.image}
          fallback={<div class="card-image placeholder">{emoji()}</div>}
        >
          <img
            class="card-image"
            src={result.image}
            alt={result.name}
            loading="lazy"
            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
          />
          <div class="card-image placeholder" style="display:none">{emoji()}</div>
        </Show>
        <span class="badge-type">{emoji()} {TYPE_LABEL[result.lodgingType] ?? result.lodgingType}</span>
        <Show when={result.priceRange}>
          <span class="badge-price-range" title={PRICE_LABEL[result.priceRange]}>
            {result.priceRange}
          </span>
        </Show>
      </div>

      <div class="card-body">
        <div class="card-location">
          <Show when={result.countryName}>
            <span class="flag">{countryFlag(result.country)}</span>
            <span>{result.city}{result.city && result.countryName ? ', ' : ''}{result.countryName}</span>
          </Show>
        </div>

        <h3 class="card-title">
          <a href={result.url}>{result.name}</a>
        </h3>

        <p class="card-desc">{result.description}</p>

        <Show when={result.roomTypes.length > 0}>
          <div class="room-types">
            <For each={result.roomTypes}>
              {room => <span class="room-tag">{room}</span>}
            </For>
          </div>
        </Show>

        <div class="card-footer">
          <div class="price-block">
            <span class="price-amount">{priceFormatted()}</span>
            <span class="price-desc">{result.pricePerNight != null ? `/ noche` : ''}</span>
          </div>

          <div class="rating-block">
            <Show when={result.rating}>
              <Stars rating={result.rating} />
              <span class="rating-value">{result.rating?.toFixed(1)}</span>
              <Show when={result.reviewCount}>
                <span class="review-count">({result.reviewCount?.toLocaleString()})</span>
              </Show>
            </Show>
          </div>
        </div>

        <a href={result.url} class="cta-btn">Ver disponibilidad</a>
      </div>
    </article>
  )
}

function countryFlag(code) {
  if (!code || code.length !== 2) return '🌍'
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map(c => 0x1F1E6 - 65 + c.charCodeAt(0))
  )
}
