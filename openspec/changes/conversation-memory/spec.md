# Spec: conversation-memory

**Change**: conversation-memory
**Date**: 2026-06-24
**Status**: draft
**Depends on**: proposal.md

---

## Requirements

### REQ-01 — Conversation history accumulation

The system MUST maintain an ordered list of previous search queries (conversation
history) within a single browser session.

- History is scoped to the current tab/session; it does not persist across page reloads.
- Maximum depth: 3 entries. When a 4th query is added, the oldest is dropped (sliding window).
- History accumulates only on successful searches (status reaches `done`). Searches
  that result in `error` do not add to history.

### REQ-02 — Previous queries forwarded to NLWeb

Every search request MUST include the current conversation history as the `prev`
field in the gateway payload.

- Wire format: `{ "query": "...", "site": "localhost", "prev": ["q1", "q2"] }`
- `prev` is an array of plain strings.
- On the first search, `prev` is an empty array `[]`.
- The gateway MUST forward `prev` verbatim to NLWeb's `/ask` endpoint.

### REQ-03 — NLWeb decontextualization enabled

NLWeb's `PrevQueryDecontextualizer` MUST be active.

- `config_nlweb.yaml` MUST have `decontextualize_enabled: true`.
- When `prev` is non-empty, NLWeb calls the LLM to rewrite the current query
  incorporating prior context before retrieval.
- When `prev` is empty, no decontextualization occurs (NLWeb's existing no-op path).

### REQ-04 — Manual conversation reset

The user MUST be able to reset the conversation history at any time via a
visible UI control.

- A "Nueva búsqueda" button MUST appear when `conversationHistory` has ≥ 1 entry.
- Clicking it clears `conversationHistory` to `[]` immediately.
- After reset, the next search starts with `prev: []`.

### REQ-05 — Automatic conversation reset on inactivity

The system MUST automatically reset the conversation history after 5 minutes of
search inactivity.

- The inactivity timer starts (or resets) after each successful search.
- If the user performs no search for 5 continuous minutes, `conversationHistory`
  is cleared to `[]`.
- The timer is cleared when the user performs a manual reset.

### REQ-06 — Conversation history chips UI

The active conversation context MUST be visible to the user.

- When `conversationHistory` has ≥ 1 entry, a chip row MUST be rendered above
  the search input (inside `.search-wrapper`).
- Each chip shows the text of one previous query, truncated to 40 characters with
  an ellipsis if longer.
- Chips are ordered oldest → newest (left to right).
- The "Nueva búsqueda" button appears at the end of the chip row.
- When `conversationHistory` is empty, the chip row is NOT rendered.

---

## Scenarios

### SC-01 — First search, no context
**Given** the user has not searched before (history is empty)
**When** the user submits "hotel en Cancún"
**Then** the gateway sends `{ query: "hotel en Cancún", prev: [] }`
**And** results are returned normally
**And** history becomes `["hotel en Cancún"]`
**And** one chip "hotel en Cancún" is shown

### SC-02 — Follow-up query adds context
**Given** history is `["hotel en Cancún"]`
**When** the user submits "con camas doble para familia"
**Then** the gateway sends `{ query: "con camas doble para familia", prev: ["hotel en Cancún"] }`
**And** NLWeb decontextualizes to "hotel en Cancún camas doble familia" (or similar)
**And** history becomes `["hotel en Cancún", "con camas doble para familia"]`
**And** two chips are shown

### SC-03 — History cap at 3 entries
**Given** history is `["q1", "q2", "q3"]`
**When** the user submits "q4"
**Then** the gateway sends `{ query: "q4", prev: ["q1", "q2", "q3"] }`
**And** history becomes `["q2", "q3", "q4"]` (q1 dropped)
**And** three chips are shown

### SC-04 — Manual reset clears context
**Given** history is `["hotel en Cancún", "camas doble"]`
**When** the user clicks "Nueva búsqueda"
**Then** history becomes `[]`
**And** the chip row disappears
**And** the next search sends `prev: []`

### SC-05 — Auto-reset after 5 min inactivity
**Given** history is `["hotel en Cancún"]`
**And** the user has not searched for 5 minutes
**When** the inactivity timer fires
**Then** history becomes `[]`
**And** the chip row disappears

### SC-06 — Failed search does not pollute history
**Given** history is `["hotel en Cancún"]`
**When** the user submits a query that results in an error (network failure, NLWeb 502)
**Then** history remains `["hotel en Cancún"]` (unchanged)

### SC-07 — Chip text truncation
**Given** a previous query is "Quiero un hotel de montaña con vista a los Alpes"
**When** the chip is rendered
**Then** the chip text shows "Quiero un hotel de montaña con vist…" (40 chars + ellipsis)

---

## Non-requirements (out of scope)

- Persisting history across page reloads or browser sessions
- Sending `last_ans` (previous result URLs) to NLWeb
- Server-side conversation ID tracking
- Multi-tab synchronization
- Undo reset
