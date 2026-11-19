"""The seam the tutor calls for a reply.

Still a stub: the real Gemini call is TUT-1 (#25), and the grounded prompt that wraps the retrieved
passages is TUT-5 (#29). What matters now is the shape - a reply is produced from the session, the
conversation so far, and the tier the server decided on - so the tier can be enforced and tested
before there is a model behind it.

The tier arrives as an argument rather than being worked out here, because it is decided in
tutor/tiers.py from the stored messages. A provider that computed its own tier would be a second
opinion on the one rule that must not have one. When a model is wired up, `tiers.instruction_for`
is what tells it how much it may give away at this tier - and the cap is still applied by our own
code afterwards, never left to the prompt (#29).
"""

from tutor.models import TutorSession


def reply_for(session: TutorSession, history: list[dict], tier: int | None) -> str:
    """The assistant's reply to the last student message in history.

    `tier` is None in concept mode, or 1 to MAX_TIER_SERVED in assignment mode.
    """
    del session, history, tier  # the stub answers the same way regardless; #25 uses all three
    return "The AI is not connected on this site yet, so I cannot answer properly."
