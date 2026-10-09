# Multi-Modal AI Chatbot RAG

A Streamlit-based chatbot powered by Google's Gemini API. This is a capstone project in progress — the current version supports conversational chat, retrieval-augmented generation over an internal knowledge base, document upload and Q&A, and persistent long-term memory, with image/audio input and chunk-level retrieval planned as next steps.

## Current Features

- Chat interface built with [Streamlit](https://streamlit.io/)
- Conversation powered by the Gemini API (`gemini-3.6-flash`) via the `google-genai` SDK
- Responses are streamed token-by-token as they're generated, instead of waiting for the full reply
- Selectable chatbot persona (Travel Planner, Math Tutor, Chef, or a custom persona name) from the sidebar, or a fully custom system instruction
- Chat history persisted in Streamlit session state for the duration of a session
- Automatic conversation summarization every 10 user messages, keeping the context sent to the model small enough to avoid hitting context-length limits, without losing the full chat history shown on screen
- Long-term memory: the chatbot extracts and remembers facts, preferences, and past events about the user across sessions, retrieves what's relevant to each new message, and exposes a sidebar dashboard to view, edit, or delete what it remembers (see [Long-Term Memory](#long-term-memory) below)
- Document upload (PDF/TXT) with text extraction, so you can ask questions about a document you've uploaded (see [Document Upload](#document-upload) below)
- Retrieval-augmented generation (RAG) over an internal knowledge base: a fast model routes each question to the most relevant file, whose contents are then injected into the answering model's context (see [Internal Knowledge Base (RAG)](#internal-knowledge-base-rag) below)

## Planned

- Additional multi-modal input (images, audio)
- Chunk-level retrieval, so only the relevant passages of a large file are sent to the model rather than the whole file
- Embedding-based retrieval for the knowledge base (the memory system already does this; knowledge-base routing is currently filename-based)

## Long-Term Memory

The chatbot maintains a persistent memory store (`memories.db`, a local SQLite file) that survives across sessions — separate from the in-session chat history. It's implemented in [memory.py](memory.py).

**Memory types**

Every memory is classified as one of three types, following the standard cognitive-memory categories:
- **Semantic** — standalone facts (e.g. "The user's name is Alex", "The user is allergic to peanuts")
- **Procedural** — how the user wants things done (e.g. "Always answer in bullet points")
- **Episodic** — specific events tied to a time or occasion (e.g. "The user mentioned traveling to Japan in March 2026")

**How memories are created (extraction)**

A second, cheaper Gemini model (`gemini-3.1-flash-lite`) acts as a dedicated memory-management agent. Every 10 user messages — the same cadence as conversation summarization, and over the same batch of messages — it's given:
1. The entire current memory store (each memory's id, type, and content)
2. The recent conversation excerpt

Under a system prompt instructing it on the three memory types and the rules for managing them, it returns a structured JSON list of operations (`add`, `update`, or `delete`), enforced via Gemini's `response_json_schema` so the output is always well-formed. This is also how contradictions are resolved: if new information conflicts with an existing memory, the model is instructed to emit an `update` against that memory's id with the corrected content, rather than create a duplicate — the latest information always overwrites the old.

**How memories are used (retrieval)**

Before generating each reply, the user's latest message is embedded (`gemini-embedding-001`) and compared via cosine similarity against all stored memory embeddings, computed in plain Python (no vector database). The top 5 most relevant memories are injected into that turn's system instruction — never into the visible chat history, so the retrieval process stays invisible to the user.

**Memory dashboard**

The sidebar includes a "Long-Term Memory" section listing every stored memory grouped by type. Each memory can be edited in place (re-embedded automatically on save) or deleted individually, and a "Delete All Memories" button (behind a confirmation checkbox) wipes the store entirely.

## Document Upload

A file uploader at the top of the page accepts `.pdf` and `.txt` files. PDF text is extracted with [pypdf](https://pypdf.readthedocs.io/); plain-text files are decoded as UTF-8.

**How it works**

Extraction runs once, at upload time, and the result is cached in Streamlit session state keyed by filename and size — so the document isn't re-parsed on every message, and uploading a different file re-extracts automatically. The extracted text is then appended to that turn's system instruction inside explicit `--- BEGIN DOCUMENT --- / --- END DOCUMENT ---` delimiters, along with an instruction telling the model to use it as the primary source when answering questions about it. The document never enters the visible chat history.

A "Document Information" panel in the sidebar shows the filename, file size, and (for PDFs) the page count, all read from the same cache.

**Limitations**

- The *entire* document is sent with every message. There is no chunking or passage-level retrieval yet, so a long PDF consumes a large amount of context per turn — this is what the chunked-RAG item under [Planned](#planned) addresses.
- Scanned/image-only PDFs contain no selectable text, so nothing can be extracted from them. The app warns you and lets you keep chatting normally rather than failing.

## Internal Knowledge Base (RAG)

The `knowledge_base/` folder holds `.txt` files representing private, non-public information the model has no way of knowing from its training data. Each user question is routed to the single most relevant file, whose contents are injected into the answering model's context. This implements the three standard RAG stages:

**1. Retrieval**

`get_knowledge_file()` sends the user's question plus the list of available filenames to a fast, cheap model (`gemini-3.1-flash-lite`) acting as a document router. Rather than parsing a filename out of free-form text, the response is constrained with Gemini's structured output:

```python
response_json_schema={"type": "string", "enum": available_files + ["NONE"]}
```

This makes it structurally impossible for the router to return anything except a real filename or `NONE`. The returned name is additionally checked against the actual directory listing before any file is opened, since model output shouldn't be trusted as a file path. Routing costs roughly 100 tokens per message, which is added to the cumulative token counter.

**2. Augmentation**

If a file is selected, its contents are read and appended to that turn's system instruction inside `--- BEGIN KNOWLEDGE BASE --- / --- END KNOWLEDGE BASE ---` delimiters, together with an instruction stating that this is private information that takes precedence over the model's own general knowledge when the two conflict. If the router returns `NONE`, nothing is injected and the chatbot answers normally.

**3. Generation**

The main model (`gemini-3.6-flash`) answers using the augmented instruction. When a file was used, a `📚 Retrieved from knowledge base: <filename>` caption appears beneath the reply so retrieval is visible rather than silent.

**Sample data and how to verify it works**

Three sample files ship with the project — `harvard.txt`, `duke.txt`, and `cornell.txt` — each a fictional "internal advising memo" containing invented specifics that no language model could know from training: internal program codes (`PQF-441`, `FAST-902`, `IFSS-1130`), exact stipend figures, fictional faculty directors, and internal portal names. Every file is clearly headed as fictional test data so it can't be mistaken for a genuine institutional record.

To confirm retrieval is actually working, ask something only the files would answer:

> What is the stipend for the Pforzheimer Quantitative Fellowship?

A correct RAG answer cites **$47,500 plus a $3,200 computing allowance** from `harvard.txt`. If you instead get generic or real-world information about Harvard, retrieval did not fire.

**Limitation**

The router sees only **filenames**, never file contents, so routing accuracy depends on filenames describing their subject. `harvard.txt` works; `doc1.txt` would not. Scaling this up means either keeping filenames descriptive or moving to embedding-based retrieval like the memory system uses.

## Prerequisites

- Python 3.12+
- A [Gemini API key](https://ai.google.dev/gemini-api/docs/api-key)

## Setup

1. Clone the repository and move into the project directory.

2. (Recommended) Create and activate a virtual environment:
   ```
   python -m venv venv
   venv\Scripts\activate
   ```

3. Install dependencies:
   ```
   python -m pip install -r requirements.txt
   ```

4. Create a `.env` file in the project root with your Gemini API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```
   `.env` is already listed in `.gitignore`, so it won't be committed.

## Running the app

Streamlit apps must be started with the `streamlit run` command, not `python`:

```
streamlit run AI_Chatbot.py
```

This starts a local server (default `http://localhost:8501`) and opens the app in your browser.

## Running with Docker

Build the image:
```
docker build -t multi-modal-ai-chatbot-rag .
```

Run the container, passing your API key and mapping Streamlit's port:
```
docker run -p 8501:8501 --env-file .env multi-modal-ai-chatbot-rag
```

## Project Structure

```
.
├── AI_Chatbot.py        # Streamlit app entry point
├── memory.py            # Long-term memory: storage, extraction, retrieval
├── knowledge_base/      # Internal knowledge base files used for RAG
│   ├── harvard.txt
│   ├── duke.txt
│   └── cornell.txt
├── requirements.txt     # Python dependencies
├── Dockerfile           # Container build definition
├── .dockerignore
├── .gitignore
├── .env                 # Local secrets (not committed)
└── memories.db          # Long-term memory store, created at runtime (not committed)
```
