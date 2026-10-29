"""The Hyntor tutor: a simple chat page.

This is the page the Django site hands people to. It checks the signed hand-off token, shows a chat
box, and answers with Gemini. Course materials, hint tiers and citations are not here yet - that is
TUT-3 and TUT-7. The richer retrieval chatbot in AI_Chatbot.py is kept for that work.

Run it alongside the Django site:

    streamlit run tutor_chat/tutor.py --server.port 8501
"""

import os

import handoff
import streamlit as st
from dotenv import load_dotenv

load_dotenv()

HANDOFF_SECRET = os.environ.get("HANDOFF_SECRET", "")
MODEL = os.environ.get("GEMINI_MODEL") or "gemini-3.6-flash"

# On Render only the hostname is supplied, so an https:// address is built from it.
_SITE_HOST = os.environ.get("HYNTOR_SITE_HOST", "")
HYNTOR_SITE_URL = os.environ.get("HYNTOR_SITE_URL") or (f"https://{_SITE_HOST}" if _SITE_HOST else "")

GREETING = "Hi. Ask me about anything in your course, and I'll help you work it out."

# Hints before answers is the product rule (D3). It lives here as a prompt for now; TUT-3 moves the
# tiers server-side, where a prompt cannot talk its way past them.
SYSTEM_PROMPT = (
    "You are Hyntor, a university study tutor. Help the student reach the answer themselves: "
    "start with a hint or a question that points the way, and give a full worked answer only if "
    "they ask again or are clearly stuck. Be brief and concrete. If you are unsure, say so."
)

st.set_page_config(page_title="Hyntor tutor", page_icon="🎓")

# Colours come from .streamlit/config.toml, which has no option for heading colour. These two rules
# finish the job: headings in the deep brand blue, matching h1 on the Django pages (app.css).
st.markdown(
    """
    <style>
      h1, h2, h3 { color: #1B2A6B; }
      [data-testid="stSidebar"] { border-right: 1px solid #D4DDF9; }
    </style>
    """,
    unsafe_allow_html=True,
)


def stop_with(message: str) -> None:
    """Show why they cannot be here, and stop. Nothing below this runs."""
    st.title("Hyntor tutor")
    st.error(message)
    if HYNTOR_SITE_URL:
        st.markdown(f"[Sign in to Hyntor]({HYNTOR_SITE_URL}/login/) and open the tutor from there.")
    st.stop()


def signed_in_user() -> dict:
    """Who this chat belongs to, from the hand-off token Django sent."""
    if "hyntor_user" in st.session_state:
        return st.session_state.hyntor_user

    # Fail closed: with no secret, no token can be checked, so nobody gets in.
    if not HANDOFF_SECRET:
        stop_with("This tutor is not configured correctly, so sign-in cannot be checked.")

    try:
        user = handoff.read_token(HANDOFF_SECRET, st.query_params.get("t"))
    except handoff.InvalidToken:
        stop_with("This link is not valid or has expired.")

    st.session_state.hyntor_user = user
    # Take the token out of the address bar so it is not shared or bookmarked.
    st.query_params.clear()
    return user


@st.cache_resource
def gemini_client():
    """One client per server process, built only when a key is configured."""
    from google import genai

    return genai.Client()


def ai_is_configured() -> bool:
    return bool(os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))


def answer(question: str, history: list[dict]) -> str:
    """The tutor's reply. Without a key the page still works, and says why it cannot answer (G6)."""
    if not ai_is_configured():
        return (
            "The AI is not connected on this site yet, so I cannot answer properly. "
            "An administrator needs to add a Gemini key. Everything else here works."
        )

    from google.genai import types

    contents = [
        {"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]}
        for m in history
    ]
    try:
        response = gemini_client().models.generate_content(
            model=MODEL,
            contents=contents,
            config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT),
        )
        return response.text or "I did not manage to answer that. Try rephrasing it?"
    except Exception as exc:  # noqa: BLE001 - any provider failure must stay inside the chat
        # A provider outage should read as a message in the conversation, not a crashed page.
        return f"I could not reach the AI service just now ({type(exc).__name__}). Please try again."


user = signed_in_user()

st.title("Hyntor tutor")
st.caption(f"Signed in as {user.get('name') or user.get('email')}")

if not ai_is_configured():
    st.warning("The AI is not connected on this site yet. The chat works, but answers are placeholders.")

if "messages" not in st.session_state:
    st.session_state.messages = [{"role": "assistant", "content": GREETING}]

for message in st.session_state.messages:
    st.chat_message(message["role"]).write(message["content"])

if question := st.chat_input("Ask about your course..."):
    st.session_state.messages.append({"role": "user", "content": question})
    st.chat_message("user").write(question)

    with st.chat_message("assistant"), st.spinner("Thinking..."):
        reply = answer(question, st.session_state.messages)
        st.write(reply)

    st.session_state.messages.append({"role": "assistant", "content": reply})

with st.sidebar:
    st.header("This conversation")
    st.caption(f"{sum(1 for m in st.session_state.messages if m['role'] == 'user')} questions asked")

    if st.button("Start over"):
        st.session_state.messages = [{"role": "assistant", "content": GREETING}]
        st.rerun()

    if HYNTOR_SITE_URL:
        st.divider()
        st.markdown(f"[Back to Hyntor]({HYNTOR_SITE_URL})")
