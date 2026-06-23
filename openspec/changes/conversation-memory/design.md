# Design: conversation-memory

**Change**: conversation-memory
**Date**: 2026-06-24
**Status**: draft
**Depends on**: spec.md

---

## Architecture overview

Three layers each get one focused change. No new modules, no new abstractions.

```
┌─────────────────────────────────────────┐
│  Frontend (SolidJS)                     │
│                                         │
│  search.js                              │
│    conversationHistory signal (max 3)   │
│    ├── sends prev[] on every fetch      │
│    ├── appends on success only          │
│    ├── resetConversation() exported     │
│    └── 5-min inactivity timer           │
│                                         │
│  SearchBar.jsx                          │
│    ├── <ConversationChips> (new)        │
│    └── "Nueva búsqueda" button          │
└────────────────┬────────────────────────┘
                 │ POST /search { query, site, prev[] }
┌────────────────▼────────────────────────┐
│  Gateway (Rust / Axum)                  │
│                                         │
│  SearchRequest                          │
│    + prev: Option<Vec<String>>          │
│                                         │
│  search_proxy()                         │
│    forwards prev to NLWeb body          │
└────────────────┬────────────────────────┘
                 │ POST /ask { query, site, prev[], meta }
┌────────────────▼────────────────────────┐
│  NLWeb (Python)                         │
│                                         │
│  config_nlweb.yaml                      │
│    decontextualize_enabled: true        │
│                                         │
│  PrevQueryDecontextualizer (existing)   │
│    rewrites query with LLM              │
│    → downstream retrieval uses          │
│      decontextualized query             │
└─────────────────────────────────────────┘
```

---

## Layer 1 — Backend config

**File**: `backend/config/config_nlweb.yaml`

One-line change:

```yaml
# before
decontextualize_enabled: false

# after
decontextualize_enabled: true
```

No other config changes needed. `analyze_query_enabled` and `memory_enabled`
stay false — they are separate features.

---

## Layer 2 — Gateway (Rust)

**File**: `gateway/src/main.rs`

### SearchRequest struct

```rust
#[derive(Deserialize)]
struct SearchRequest {
    query: String,
    #[serde(default = "default_site")]
    site: String,
    #[serde(default)]
    prev: Vec<String>,          // new field; defaults to empty vec via serde(default)
}
```

Using `Vec<String>` with `#[serde(default)]` instead of `Option<Vec<String>>`:
- Avoids an `unwrap_or_default()` at the call site.
- An absent `prev` key in JSON deserializes to `[]` automatically.

### NLWeb body construction

```rust
let nlweb_body = serde_json::json!({
    "query": payload.query,
    "site":  payload.site,
    "prev":  payload.prev,       // new field — forwarded verbatim
    "meta":  { "version": "0.55" }
});
```

No other changes to `search_proxy`. The rest of the streaming proxy is unchanged.

---

## Layer 3 — Frontend store (SolidJS)

**File**: `frontend/src/stores/search.js`

### New signals and constants

```js
const HISTORY_MAX = 3
const INACTIVITY_MS = 5 * 60 * 1000   // 5 minutes

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
```

### Modified search() function

```js
export async function search(query) {
  if (!query.trim()) return

  const prev = conversationHistory()      // capture before clearing results

  setResults([])
  setStatus('loading')
  setErrorMsg('')
  setSceneBg(detectScene(query))

  try {
    const response = await fetch('/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, site: 'localhost', prev }),   // prev added
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    // ... existing SSE streaming logic unchanged ...

    setResults(prev => [...prev].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)))
    setStatus('done')

    // Append to history only on success (REQ-01, SC-06)
    setConversationHistory(h => [...h, query].slice(-HISTORY_MAX))
    resetInactivityTimer()

  } catch (err) {
    setErrorMsg(err.message)
    setStatus('error')
    // history NOT updated on error (REQ-01, SC-06)
  }
}
```

### Why capture `prev` before `setResults([])`

`conversationHistory` is a separate signal — clearing results doesn't affect it.
But capturing it at the top of `search()` makes the intent explicit: "these are
the queries that were active when this search was triggered."

---

## Layer 4 — Frontend UI (SolidJS)

**File**: `frontend/src/components/SearchBar.jsx`

### New imports

```js
import { conversationHistory, resetConversation } from '../stores/search.js'
```

### ConversationChips component (inline, no new file)

```jsx
function ConversationChips() {
  const truncate = (text) =>
    text.length > 40 ? text.slice(0, 40) + '…' : text

  return (
    <Show when={conversationHistory().length > 0}>
      <div class="conversation-chips">
        <For each={conversationHistory()}>
          {(q) => <span class="chip">{truncate(q)}</span>}
        </For>
        <button
          type="button"
          class="chip chip--reset"
          onClick={resetConversation}
        >
          Nueva búsqueda
        </button>
      </div>
    </Show>
  )
}
```

### Integration into SearchBar render

```jsx
return (
  <div class="search-wrapper">
    <ConversationChips />          {/* new — above the form */}
    <form class="search-bar" onSubmit={handleSubmit}>
      {/* ... unchanged ... */}
    </form>
    {/* ... suggestions and filters unchanged ... */}
  </div>
)
```

### CSS additions (inline in existing styles)

Added to the existing stylesheet (whichever file contains `.search-wrapper`):

```css
.conversation-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding: 0.5rem 0 0.25rem;
}

.chip {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 999px;
  padding: 0.2rem 0.75rem;
  font-size: 0.8rem;
  white-space: nowrap;
}

.chip--reset {
  background: rgba(255, 255, 255, 0.08);
  cursor: pointer;
  font-weight: 600;
}

.chip--reset:hover {
  background: rgba(255, 255, 255, 0.22);
}
```

---

## Data flow (complete, per search)

```
1. User submits query Q
2. search(Q) called
3.   prev = conversationHistory()          e.g. ["q1", "q2"]
4.   fetch POST /search { query: Q, site, prev }
5.   Gateway deserializes; prev: Vec<String> = ["q1", "q2"]
6.   Gateway POSTs to NLWeb /ask { query: Q, site, prev: ["q1","q2"], meta }
7.   NLWeb: decontextualize_enabled=true, len(prev)>0
8.     → PrevQueryDecontextualizer calls LLM
9.     → LLM rewrites Q incorporating prev → Q'
10.    → Retrieval runs on Q' (decontextualized query)
11.  SSE results stream back through gateway → frontend
12.  On success: conversationHistory updated to [...prev, Q].slice(-3)
13.  Inactivity timer reset to 5 min
14.  Chips re-render with updated history
```

---

## Edge cases

| Case | Behaviour |
|------|-----------|
| `prev` has 3 entries, new search succeeds | Oldest dropped; window slides |
| Search fails (network/502) | History unchanged; timer NOT reset |
| User clicks "Nueva búsqueda" mid-search | History clears immediately; in-flight request completes with old prev (harmless) |
| LLM fails to decontextualize | NLWeb falls back to original query (existing NLWeb behaviour) |
| Tab closed / page reload | History lost (in-memory only, by design) |
| Inactivity timer fires during active search | Timer fires; history clears; in-flight request completes normally |
