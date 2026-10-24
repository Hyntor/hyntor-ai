"""Long-term memory for the tutor: facts worth keeping between conversations.

Originally written by Bat-Orgil Erdenebat in multi-modal-ai-chatbot-rag. Adapted for Hyntor by
adding a `user_key` to every row and every query, so one person's memories are invisible to
everyone else. Before that change the store was global: any signed-in user could read, edit and
delete every other user's memories from the sidebar.

Every function therefore takes `user_key` first. Updates and deletes match on BOTH the row id and
the user_key, so a guessed or forged id still cannot reach another person's row.
"""

import json
import math
import os
import sqlite3
from contextlib import contextmanager
from datetime import UTC, datetime

from google.genai import types

# On Render the container filesystem is rebuilt on every deploy, so this file does not survive one.
# That is acceptable for the demo; moving memories into PostgreSQL is tracked as follow-up work.
DEFAULT_DB_PATH = "memories.db"


def _db_path() -> str:
    """Where the memory store lives.

    Read on every call rather than once at import, so the setting is whatever the environment says
    now. A module-level constant would freeze the first value this process ever saw, which breaks
    tests that point each case at its own file.
    """
    return os.environ.get("MEMORY_DB_PATH") or DEFAULT_DB_PATH


EMBEDDING_MODEL = "gemini-embedding-001"
EXTRACTION_MODEL = "gemini-3.1-flash-lite"

MEMORY_TYPES = ("semantic", "procedural", "episodic")

EXTRACTION_SCHEMA = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["add", "update", "delete"]},
            "memory_id": {"type": "integer"},
            "memory_type": {"type": "string", "enum": list(MEMORY_TYPES)},
            "content": {"type": "string"},
        },
        "required": ["action", "memory_type", "content"],
    },
}

EXTRACTION_SYSTEM_PROMPT = """You are the memory-management module of a chatbot. Your job is to decide what should be permanently remembered about the user and the conversation, and to keep the memory store accurate and free of contradictions.

There are three types of memory:
- semantic: standalone facts (e.g. "The user's name is Alex", "The user is a Python developer", "The user is allergic to peanuts")
- procedural: how the user wants things done, preferences about process or style (e.g. "Always answer in bullet points", "The user prefers metric units")
- episodic: specific events or experiences mentioned in the conversation, tied to a time or occasion (e.g. "The user said they are traveling to Japan in March 2026")

You will be given the CURRENT MEMORY STORE (existing memories with their ids) and a RECENT CONVERSATION EXCERPT. For each memory-worthy piece of information, output an operation:
- "add": a genuinely new memory not already covered by an existing one.
- "update": an existing memory (reference its memory_id) whose content is outdated or contradicted by newer information. Always prefer the LATEST information when something conflicts with an existing memory - put the corrected, up-to-date content in "content".
- "delete": an existing memory (reference its memory_id) that is no longer true and should be removed entirely, with no replacement.

Rules:
- Do not create duplicate memories for the same fact.
- Only remember information that would plausibly be useful in a future, unrelated conversation. Ignore small talk, one-off questions, and anything not worth persisting.
- If nothing in the excerpt is memory-worthy, return an empty array.
- Return ONLY the JSON array of operations, matching the provided schema.
"""


@contextmanager
def _connect():
    """Open the store, commit on success, and always close.

    `with sqlite3.connect(...)` alone does NOT close the connection - it only wraps a transaction -
    so the original code leaked one connection per call. On a long-running server that leaks file
    handles, and on Windows it holds a lock on the file. This wrapper closes it in a finally block.
    """
    conn = sqlite3.connect(_db_path())
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_key TEXT NOT NULL,
            memory_type TEXT NOT NULL,
            content TEXT NOT NULL,
            embedding TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    # A database written before memories were scoped has no user_key column. Add it, leaving the
    # old rows with an empty key so they belong to nobody and are never shown to anyone.
    columns = {row[1] for row in conn.execute("PRAGMA table_info(memories)")}
    if "user_key" not in columns:
        conn.execute("ALTER TABLE memories ADD COLUMN user_key TEXT NOT NULL DEFAULT ''")

    conn.execute("CREATE INDEX IF NOT EXISTS memories_by_user ON memories (user_key)")

    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def embed_text(client, text: str, task_type: str = "RETRIEVAL_DOCUMENT") -> list[float]:
    response = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
        config=types.EmbedContentConfig(task_type=task_type),
    )
    return response.embeddings[0].values


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    # strict=False keeps the original behaviour; both vectors come from the same embedding model.
    dot = sum(x * y for x, y in zip(a, b, strict=False))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def add_memory(user_key: str, memory_type: str, content: str, embedding: list[float]) -> None:
    now = datetime.now(UTC).isoformat()
    with _connect() as conn:
        conn.execute(
            "INSERT INTO memories (user_key, memory_type, content, embedding, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (user_key, memory_type, content, json.dumps(embedding), now, now),
        )


def update_memory(
    user_key: str, memory_id: int, memory_type: str, content: str, embedding: list[float]
) -> None:
    now = datetime.now(UTC).isoformat()
    with _connect() as conn:
        # Matching on user_key as well as id means a forged id cannot edit someone else's memory.
        conn.execute(
            "UPDATE memories SET memory_type = ?, content = ?, embedding = ?, updated_at = ? "
            "WHERE id = ? AND user_key = ?",
            (memory_type, content, json.dumps(embedding), now, memory_id, user_key),
        )


def delete_memory(user_key: str, memory_id: int) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM memories WHERE id = ? AND user_key = ?", (memory_id, user_key))


def delete_all_memories(user_key: str) -> None:
    """Deletes only this user's memories, never the whole table."""
    with _connect() as conn:
        conn.execute("DELETE FROM memories WHERE user_key = ?", (user_key,))


def get_all_memories(user_key: str) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, memory_type, content, updated_at FROM memories WHERE user_key = ? "
            "ORDER BY memory_type, updated_at DESC",
            (user_key,),
        ).fetchall()
    return [{"id": r[0], "memory_type": r[1], "content": r[2], "updated_at": r[3]} for r in rows]


def retrieve_relevant_memories(client, user_key: str, query: str, top_k: int = 5) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, memory_type, content, embedding FROM memories WHERE user_key = ?",
            (user_key,),
        ).fetchall()

    if not rows:
        return []

    query_embedding = embed_text(client, query, task_type="RETRIEVAL_QUERY")

    scored = []
    for row_id, memory_type, content, embedding_json in rows:
        embedding = json.loads(embedding_json)
        score = _cosine_similarity(query_embedding, embedding)
        scored.append((score, {"id": row_id, "memory_type": memory_type, "content": content}))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [memory for _, memory in scored[:top_k]]


def format_memories_for_prompt(memories: list[dict]) -> str:
    if not memories:
        return ""
    lines = "\n".join(f"- ({m['memory_type']}) {m['content']}" for m in memories)
    return (
        "\n\nRelevant long-term memories about the user (treat as accurate background "
        "context; do not mention that you are using stored memories unless asked):\n" + lines
    )


def extract_memories(client, user_key: str, conversation_messages: list[dict]) -> None:
    existing = get_all_memories(user_key)
    existing_text = (
        "\n".join(f"[id={m['id']}] ({m['memory_type']}) {m['content']}" for m in existing)
        or "(no memories yet)"
    )

    conversation_text = "\n".join(f"{msg['role']}: {msg['content']}" for msg in conversation_messages)

    prompt = f"CURRENT MEMORY STORE:\n{existing_text}\n\nRECENT CONVERSATION EXCERPT:\n{conversation_text}"

    response = client.models.generate_content(
        model=EXTRACTION_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=EXTRACTION_SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_json_schema=EXTRACTION_SCHEMA,
        ),
    )

    try:
        operations = json.loads(response.text)
    except (json.JSONDecodeError, TypeError):
        return

    for op in operations:
        action = op.get("action")
        memory_type = op.get("memory_type")
        content = (op.get("content") or "").strip()
        memory_id = op.get("memory_id")

        if action == "add" and content and memory_type in MEMORY_TYPES:
            embedding = embed_text(client, content)
            add_memory(user_key, memory_type, content, embedding)
        elif action == "update" and memory_id and content and memory_type in MEMORY_TYPES:
            embedding = embed_text(client, content)
            update_memory(user_key, memory_id, memory_type, content, embedding)
        elif action == "delete" and memory_id:
            delete_memory(user_key, memory_id)
