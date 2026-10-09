# Prototypes — reference only, not deployed

Code in this directory is **not part of the Hyntor application**. It is kept as the reference
implementation that the TypeScript port is derived from, so the port can be checked against
something that actually ran.

Nothing here is built, typechecked, deployed, or covered by CI. The root `package.json`
workspaces are `apps/web` and `packages/*`, so `prototypes/` is outside the npm workspace
graph by construction.

## `chatbot/` — multi-modal RAG chatbot

Python / Streamlit / Gemini. Originally <https://github.com/BatOrgil7/multi-modal-ai-chatbot-rag>,
imported here with `git subtree` so its history is preserved.

Run it standalone if you need to compare behaviour:

```bash
cd prototypes/chatbot
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
streamlit run AI_Chatbot.py
```

It needs its own Gemini API key in a local `.env` and writes a local `memories.db`. Neither is
tracked.

### What gets ported, and where

| Prototype feature | Where it lives in the prototype | Ported by |
|---|---|---|
| Gemini client + model selection | `AI_Chatbot.py` (`genai.Client`) | **B1** — provider adapter in `packages/api` |
| Knowledge-base retrieval routing | `get_knowledge_file()` | **B2** — chunk retrieval over `MaterialChunk` |
| JSON-mode output + validating the model's choice against the real file list | `get_knowledge_file()` | **B3** — citation IDs validated against retrieved chunks |
| Long-term memory (semantic / procedural / episodic) | `memory.py` | **C1** — `Memory` model, scoped per user *and* per course |
| Memory extraction + embedding similarity | `extract_memories()`, `embed_text()` | **C2** |
| Conversation summarization every 10 messages | `summarize_conversation()` | **C3** |
| Token accounting | `st.session_state.total_tokens` | **C4** — recorded per message, with caps |
| In-chat document upload | `extract_file_data()` | Already covered by Hyntor's material upload + `extract.ts` |

### What is deliberately **not** ported

| Prototype feature | Why not |
|---|---|
| Free-text persona box (`"Define your chatbot's role"`) | Direct tier-bypass surface — a student could set "always give complete solutions". See **T4** in the requirements doc and issue **F1**. |
| "More authoritative than your own general knowledge" framing on retrieved text | Tells the model to treat attacker-controlled upload content as instructions. Inverts the **T4 / D6** mitigation. See **D2**. |
| Single-file retrieval (one knowledge file per question) | Too coarse at the documented scale of 500 materials per course (**N3**). See **B2**. |
| Token-cost sidebar as end-user UI | Useful while prototyping; not a student-facing feature. Accounting moves server-side in **C4**. |
| `knowledge_base/*.txt` (cornell, duke, harvard) | Prototype fixtures. Never used as Hyntor seed data. |

### Known defects in the prototype — do not carry these forward

Tracked in issue **F1**:

- `"assisstant"` is misspelled throughout, including in the role-mapping condition. In the TS
  port this would silently map every assistant turn to `user`.
- `memory.py` writes to one global `memories.db` with **no owner column** — a cross-user data
  leak in a multi-tenant app. **C1** scopes it.
- Placeholder copy (`"Yo what up boi, U need help?"`).
- `__pycache__/*.pyc` was tracked in the source repo; untracked here and ignored.
