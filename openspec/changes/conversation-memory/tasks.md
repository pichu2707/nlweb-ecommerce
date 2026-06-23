# Tasks: conversation-memory

**Change**: conversation-memory
**Date**: 2026-06-24
**Status**: ready
**Depends on**: spec.md, design.md

---

## Review Workload Forecast

- Estimated changed lines: ~55
- Files touched: 4
- Chained PRs recommended: No
- 400-line budget risk: Low
- Decision needed before apply: No

---

## Task list

### TASK-01 — Enable NLWeb decontextualization
**File**: `backend/config/config_nlweb.yaml`
**Covers**: REQ-03
**Lines changed**: ~1

Change `decontextualize_enabled: false` → `decontextualize_enabled: true`.

Acceptance:
- [ ] `config_nlweb.yaml` line 10 reads `decontextualize_enabled: true`

---

### TASK-02 — Add `prev` field to gateway SearchRequest
**File**: `gateway/src/main.rs`
**Covers**: REQ-02
**Lines changed**: ~5

1. Add `#[serde(default)] prev: Vec<String>` to the `SearchRequest` struct.
2. Add `"prev": payload.prev` to the `nlweb_body` JSON object in `search_proxy`.

Acceptance:
- [ ] `SearchRequest` struct has `prev: Vec<String>` with `#[serde(default)]`
- [ ] `nlweb_body` includes `"prev": payload.prev`
- [ ] `cargo build` succeeds with no errors or warnings

---

### TASK-03 — Add conversation history store logic
**File**: `frontend/src/stores/search.js`
**Covers**: REQ-01, REQ-02, REQ-04, REQ-05, SC-06
**Lines changed**: ~30

1. Export `conversationHistory` signal (initial value `[]`).
2. Add `HISTORY_MAX = 3` and `INACTIVITY_MS = 5 * 60 * 1000` constants.
3. Add module-level `inactivityTimer` variable.
4. Add `resetInactivityTimer()` private function (clears and restarts the timer).
5. Export `resetConversation()` (clears timer + resets history to `[]`).
6. In `search()`:
   - Capture `prev = conversationHistory()` at the top.
   - Add `prev` to the fetch body JSON.
   - After `setStatus('done')`: append query to history with `.slice(-HISTORY_MAX)`; call `resetInactivityTimer()`.
   - On error path: do NOT update history or timer.

Acceptance:
- [ ] `conversationHistory` and `resetConversation` are exported
- [ ] First search sends `prev: []`
- [ ] Second search sends `prev: ["first query"]`
- [ ] Fourth query drops the oldest (sliding window of 3)
- [ ] Error search leaves history unchanged
- [ ] Manual reset clears history to `[]`
- [ ] 5-min timer clears history when it fires

---

### TASK-04 — Add ConversationChips UI to SearchBar
**File**: `frontend/src/components/SearchBar.jsx`
**Covers**: REQ-06, SC-07
**Lines changed**: ~20

1. Import `conversationHistory` and `resetConversation` from the store.
2. Define `ConversationChips()` inline component inside the file:
   - Wraps everything in `<Show when={conversationHistory().length > 0}>`.
   - Uses `<For each={conversationHistory()}>` to render one `.chip` span per entry.
   - Truncates chip text to 40 chars + `…` if longer.
   - Renders "Nueva búsqueda" button with class `.chip.chip--reset` after the chips.
3. Render `<ConversationChips />` inside `.search-wrapper`, above `<form>`.

Acceptance:
- [ ] Chips are not rendered when history is empty
- [ ] One chip per history entry, oldest first
- [ ] Chip text truncated to 40 chars + ellipsis when longer
- [ ] "Nueva búsqueda" button calls `resetConversation()`
- [ ] Chips disappear after reset

---

### TASK-05 — Add chip CSS styles
**File**: `frontend/src/styles/` (whichever `.css` file contains `.search-wrapper` styles)
**Covers**: REQ-06
**Lines changed**: ~20

Add styles for `.conversation-chips`, `.chip`, and `.chip--reset` as specified
in design.md (glass-morphism style consistent with the existing header).

Acceptance:
- [ ] Chips render as pill-shaped translucent badges on the gradient header
- [ ] "Nueva búsqueda" button visually distinct (slightly different background)
- [ ] Hover state on "Nueva búsqueda" button

---

## Dependency order

```
TASK-01  (independent — config only)
TASK-02  (independent — Rust only)
TASK-03  (independent — store logic)
TASK-04  depends on TASK-03 exported symbols
TASK-05  depends on TASK-04 class names
```

TASK-01, TASK-02, TASK-03 can be implemented in parallel.
TASK-04 must follow TASK-03.
TASK-05 must follow TASK-04.
