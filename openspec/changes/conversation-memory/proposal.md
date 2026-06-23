# Proposal: conversation-memory

**Change**: conversation-memory
**Date**: 2026-06-24
**Status**: proposed

## Intent

Enable conversational context in NLTravel so that follow-up queries refine the
previous search instead of starting fresh. Users can progressively narrow their
search by adding constraints in natural language without repeating context.

## Problem

Currently every search is stateless. A user who searches "hotel en Cancún" and
then types "con camas doble para familia" gets results for "camas doble para
familia" — NLWeb has no knowledge of the prior query. The user must rephrase the
full intent every time.

## Solution

Activate NLWeb's built-in `PrevQueryDecontextualizer` mechanism and wire it end
to end: frontend → gateway → NLWeb. The LLM rewrites the current query
incorporating previous queries before retrieval.

### Flow

```
User: "Busco hotel en Cancún"
  prev: []
  NLWeb searches: "hotel en Cancún"

User: "con camas doble para familia"
  prev: ["Busco hotel en Cancún"]
  NLWeb decontextualizes → "hotel en Cancún camas doble familia"
  NLWeb searches the rewritten query

User: "que no supere 150 euros"
  prev: ["Busco hotel en Cancún", "con camas doble para familia"]
  NLWeb decontextualizes → "hotel en Cancún camas doble familia menos de 150 euros"
```

## Scope

4 files, 3 layers:

| Layer    | File                                          | Change                                      |
|----------|-----------------------------------------------|---------------------------------------------|
| Backend  | `backend/config/config_nlweb.yaml`            | `decontextualize_enabled: true`             |
| Gateway  | `gateway/src/main.rs`                         | Add `prev` field; forward to NLWeb          |
| Frontend | `frontend/src/stores/search.js`               | Maintain history signal; send `prev`; reset |
| Frontend | `frontend/src/components/SearchBar.jsx`       | History chips UI; "Nueva búsqueda" button   |

## Key Decisions

- **Wire field**: `prev` (array of strings) — verified from NLWeb source
- **History depth**: max 3 previous queries — more causes stale context confusion
- **Reset strategy**: both manual (button) AND automatic (5 min inactivity)
- **Visual indicator**: conversation history chips shown above the search input
- **LLM**: llama3.2:3b via Ollama (local) handles decontextualization

## Out of Scope

- Persistent conversation storage across sessions
- Server-side conversation ID / thread tracking
- `last_ans` (previous answers/URLs) forwarding — added complexity, low ROI for prototype
- Authentication or multi-user contexts

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| llama3.2:3b misinterprets decontextualization prompt | Medium | Test with 2–3 query chains; fallback is original query passes through unchanged |
| Gateway Rust compile error on struct change | Low | Straightforward serde derive addition |
| 5-min timer leaks if component unmounts | Low | Clear timer in cleanup |

## Estimated Size

~40–60 changed lines across 4 files. Well within 400-line budget.
