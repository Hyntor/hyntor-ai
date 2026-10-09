import json
import math
import sqlite3
from datetime import datetime, timezone

from google.genai import types

DB_PATH = "memories.db"
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


def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            memory_type TEXT NOT NULL,
            content TEXT NOT NULL,
            embedding TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    return conn


def embed_text(client, text: str, task_type: str = "RETRIEVAL_DOCUMENT") -> list[float]:
    response = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
        config=types.EmbedContentConfig(task_type=task_type),
    )
    return response.embeddings[0].values


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def add_memory(memory_type: str, content: str, embedding: list[float]) -> None:
    now = datetime.now(timezone.utc).isoformat()
    with _connect() as conn:
        conn.execute(
            "INSERT INTO memories (memory_type, content, embedding, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (memory_type, content, json.dumps(embedding), now, now),
        )


def update_memory(memory_id: int, memory_type: str, content: str, embedding: list[float]) -> None:
    now = datetime.now(timezone.utc).isoformat()
    with _connect() as conn:
        conn.execute(
            "UPDATE memories SET memory_type = ?, content = ?, embedding = ?, updated_at = ? WHERE id = ?",
            (memory_type, content, json.dumps(embedding), now, memory_id),
        )


def delete_memory(memory_id: int) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM memories WHERE id = ?", (memory_id,))


def delete_all_memories() -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM memories")


def get_all_memories() -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, memory_type, content, updated_at FROM memories ORDER BY memory_type, updated_at DESC"
        ).fetchall()
    return [
        {"id": r[0], "memory_type": r[1], "content": r[2], "updated_at": r[3]}
        for r in rows
    ]


def retrieve_relevant_memories(client, query: str, top_k: int = 5) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute("SELECT id, memory_type, content, embedding FROM memories").fetchall()

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


def extract_memories(client, conversation_messages: list[dict]) -> None:
    existing = get_all_memories()
    existing_text = "\n".join(
        f"[id={m['id']}] ({m['memory_type']}) {m['content']}" for m in existing
    ) or "(no memories yet)"

    conversation_text = "\n".join(
        f"{msg['role']}: {msg['content']}" for msg in conversation_messages
    )

    prompt = (
        f"CURRENT MEMORY STORE:\n{existing_text}\n\n"
        f"RECENT CONVERSATION EXCERPT:\n{conversation_text}"
    )

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
            add_memory(memory_type, content, embedding)
        elif action == "update" and memory_id and content and memory_type in MEMORY_TYPES:
            embedding = embed_text(client, content)
            update_memory(memory_id, memory_type, content, embedding)
        elif action == "delete" and memory_id:
            delete_memory(memory_id)
