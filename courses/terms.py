"""Which academic term we are in.

Enrollment is keyed on a term, so joining a course needs to know which one to join. The format is
the one used throughout the project: "2026-FA".

The boundaries follow the Ole Miss academic calendar closely enough for enrollment: spring runs
January to May, summer June and July, autumn August to December. A course joined in late December
belongs to the autumn term, which is what a student browsing over the winter break expects.
"""

from datetime import date

SPRING = "SP"
SUMMER = "SU"
FALL = "FA"

# Month number -> term code. January is 1.
_TERM_BY_MONTH = {
    1: SPRING, 2: SPRING, 3: SPRING, 4: SPRING, 5: SPRING,
    6: SUMMER, 7: SUMMER,
    8: FALL, 9: FALL, 10: FALL, 11: FALL, 12: FALL,
}  # fmt: skip

TERM_NAMES = {SPRING: "Spring", SUMMER: "Summer", FALL: "Fall"}


def term_for(on: date) -> str:
    """The term a given date falls in, e.g. date(2026, 11, 11) -> '2026-FA'."""
    return f"{on.year}-{_TERM_BY_MONTH[on.month]}"


def current_term() -> str:
    """The term to enroll someone in today."""
    return term_for(date.today())


def term_label(term: str) -> str:
    """'2026-FA' -> 'Fall 2026', for showing a person rather than storing."""
    year, _, code = term.partition("-")
    return f"{TERM_NAMES.get(code, code)} {year}"
