from tutor.models import TutorSession
 
def reply_for(session: TutorSession, history: list[dict]) -> str:
    """The assistant's reply to the last student message in history"""
    return "The AI is not connected on this site yet, so I cannot answer properly."