# Apply Progress: conversation-memory

**Date**: 2026-06-24
**Status**: complete

## Tasks completed

- [x] TASK-01 — `backend/config/config_nlweb.yaml`: `decontextualize_enabled: true`
- [x] TASK-02 — `gateway/src/main.rs`: `prev: Vec<String>` in struct + forwarded to NLWeb body
- [x] TASK-03 — `frontend/src/stores/search.js`: `conversationHistory` signal, `resetConversation()`, inactivity timer, `prev` in fetch body, history appended on success only
- [x] TASK-04 — `frontend/src/components/SearchBar.jsx`: `ConversationChips` component with `Show`/`For`, truncation, "Nueva búsqueda" button
- [x] TASK-05 — `frontend/src/styles/global.css`: `.conversation-chips`, `.chip`, `.chip--reset` styles

## Verification

- `cargo build` in gateway: ✅ no errors, no warnings
- All 5 files modified as per design.md

## Files changed

1. `backend/config/config_nlweb.yaml` — 1 line changed
2. `gateway/src/main.rs` — +4 lines (struct field + body field)
3. `frontend/src/stores/search.js` — +25 lines (signals, timer, history logic)
4. `frontend/src/components/SearchBar.jsx` — +20 lines (imports, component, render)
5. `frontend/src/styles/global.css` — +28 lines (chip styles)
