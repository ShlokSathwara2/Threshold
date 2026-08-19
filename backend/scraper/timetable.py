from __future__ import annotations

from core.schemas.models import Course, CourseResponse, TimetableSlot

# Standard SRM slot-to-day/hour mapping
# Key: slot prefix (e.g. "A1"), Value: list of (day, hour) tuples
# Days: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri
SLOT_MATRIX: dict[str, list[tuple[int, int]]] = {
    # Theory slots — Hour 1
    "A1": [(1, 1), (3, 1), (5, 1)],
    "B1": [(1, 2), (2, 1), (4, 1)],
    "C1": [(2, 2), (3, 2), (4, 2)],
    "D1": [(1, 3), (3, 3), (5, 3)],
    "E1": [(2, 3), (4, 3), (5, 2)],
    "F1": [(1, 4), (3, 4), (5, 4)],
    "G1": [(2, 4), (4, 4), (5, 5)],
    # Theory slots — Hour 2
    "A2": [(1, 1), (3, 1), (5, 1)],
    "B2": [(1, 2), (2, 1), (4, 1)],
    "C2": [(2, 2), (3, 2), (4, 2)],
    "D2": [(1, 3), (3, 3), (5, 3)],
    "E2": [(2, 3), (4, 3), (5, 2)],
    "F2": [(1, 4), (3, 4), (5, 4)],
    "G2": [(2, 4), (4, 4), (5, 5)],
    # Lab slots
    "L1": [(1, 1), (1, 2)],
    "L2": [(1, 3), (1, 4)],
    "L3": [(2, 1), (2, 2)],
    "L4": [(2, 3), (2, 4)],
    "L5": [(3, 1), (3, 2)],
    "L6": [(3, 3), (3, 4)],
    "L7": [(4, 1), (4, 2)],
    "L8": [(4, 3), (4, 4)],
    "L9": [(5, 1), (5, 2)],
    "L10": [(5, 3), (5, 4)],
    "L11": [(1, 5), (2, 5)],
    "L12": [(3, 5), (4, 5)],
    "L13": [(5, 5)],
    # Tutorial slots
    "T1": [(1, 1)],
    "T2": [(1, 2)],
    "T3": [(2, 1)],
    "T4": [(2, 2)],
    "T5": [(3, 1)],
    "T6": [(3, 2)],
    "T7": [(4, 1)],
    "T8": [(4, 2)],
    "T9": [(5, 1)],
    "T10": [(5, 2)],
}

DAY_NAMES = {1: "DO-1", 2: "DO-2", 3: "DO-3", 4: "DO-4", 5: "DO-5"}


def normalize_token(token: str) -> str:
    """Canonicalise a slot token before matrix lookup.

    Academia writes tutorials as "TA1".."TA10" while the matrix keys are
    "T1".."T10" — collapse the extra "A" so tutorial classes still resolve.
    """
    token = token.strip().upper()
    if token.startswith("TA") and len(token) > 2 and token[2:].isdigit():
        return "T" + token[2:]
    return token


class TimetableBuilder:
    """Derive timetable from course slot assignments and batch number.

    Fallback path only — used when the unified batch grid can't be fetched.
    Slot fields are tokenised the same way as the unified path ("L51-L52-"
    → ["L51", "L52"]); tokens that aren't in the matrix are skipped.
    """

    def build(self, courses: CourseResponse, batch: int) -> list[TimetableSlot]:
        schedule: list[TimetableSlot] = []

        for course in courses.courses:
            tokens: list[str] = []
            for group in (course.slot or "").rstrip("-").split("+"):
                for token in group.split("-"):
                    token = token.strip()
                    if token and token != "X" and token not in tokens:
                        tokens.append(token)
            if not tokens:
                continue

            for token in tokens:
                time_slots = SLOT_MATRIX.get(normalize_token(token), [])
                for day, hour in time_slots:
                    schedule.append(
                        TimetableSlot(
                            day=DAY_NAMES.get(day, f"Day{day}"),
                            hour=hour,
                            courseCode=course.code,
                            courseTitle=course.title,
                            slot=token,
                            faculty=course.faculty,
                            room=course.room,
                        )
                    )

        # Sort by day then hour
        day_order = {"DO-1": 0, "DO-2": 1, "DO-3": 2, "DO-4": 3, "DO-5": 4}
        schedule.sort(key=lambda s: (day_order.get(s.day, 99), s.hour))
        return schedule
