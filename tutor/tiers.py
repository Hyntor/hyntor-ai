"""Hint tiers: how much help a reply is allowed to give (TUT-3, #27, D3-D5, G4, T2).

The product's promise is that the tutor helps a student reach the answer rather than handing it
over. In assignment mode a reply starts at Tier 1 and rises by one each exchange, capped at Tier 3.
Tier 4 is the full worked solution and is never served in assignment mode - it is defined here only
so the cap has something to be a cap on. Concept mode has no tier: explaining an idea is not doing
someone's homework.

The tier is a function of what is already stored in the session, so it is computed on the server on
every call and never read from the request. Two layers would otherwise be trusting the student: the
request body, and the prompt. A prompt can be talked around - a model can be persuaded to ignore
its instructions - and a request body can simply be edited, so neither decides this. `tier_for` is
the only thing that does.
"""

from tutor.models import MessageAuthorRole, TutorMode

# The highest tier a student may actually be served. Tier 4 exists, and is never reached.
MAX_TIER_SERVED = 3

# The full worked solution. Named so the cap reads as a decision rather than a magic number.
TIER_FULL_SOLUTION = 4

# What each tier is allowed to say, in the words the prompt will use (TUT-5, #29, owns the wrapping).
TIER_INSTRUCTIONS = {
    1: (
        "Restate the goal in your own words so the student can check they have understood the "
        "question. Do not name the method and do not start solving it."
    ),
    2: (
        "Name the concept or technique this question is about, and say why it applies. Do not work "
        "through it."
    ),
    3: ("Outline the first step only, and stop there. Leave the rest of the work to the student."),
    TIER_FULL_SOLUTION: (
        "Give the full worked solution. Never served in assignment mode; concept mode does not use "
        "tiers at all."
    ),
}

# Shown next to a reply as its badge (TUT-7, #40).
TIER_LABELS = {
    1: "Goal restated",
    2: "Concept named",
    3: "First step",
    TIER_FULL_SOLUTION: "Full solution",
}


def tier_for(session, *, replies_so_far: int) -> int | None:
    """The tier the next assistant reply is served at, or None in concept mode.

    `replies_so_far` is how many assistant messages the session already holds, counted from the
    database by the caller inside the same transaction. The first reply is Tier 1, the second
    Tier 2, the third Tier 3, and every one after that stays at Tier 3.

    A failed exchange stores nothing, so the count does not move and neither does the tier (F2).
    """
    if session.mode != TutorMode.ASSIGNMENT:
        return None
    return min(replies_so_far + 1, MAX_TIER_SERVED)


def replies_in(session) -> int:
    """How many assistant replies this session already holds.

    Counted from the stored rows rather than tracked in a column, so there is no second copy of the
    tier to drift or to be written by anything but this.
    """
    return session.messages.filter(author_role=MessageAuthorRole.ASSISTANT).count()


def instruction_for(tier: int | None) -> str:
    """What to tell the model it may give away at this tier. Empty in concept mode."""
    if tier is None:
        return ""
    return TIER_INSTRUCTIONS[tier]
