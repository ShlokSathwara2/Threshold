from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from core.config import settings
from core.schemas.models import (
    AttendanceResponse,
    CalendarResponse,
    CourseResponse,
    MarksResponse,
    TimetableResponse,
    User,
)
from scraper.client import AcademiaClient
from scraper.parser import AcademiaParser
from scraper.timetable import TimetableBuilder, SLOT_MATRIX, normalize_token


DAY_NAMES = {1: "DO-1", 2: "DO-2", 3: "DO-3", 4: "DO-4", 5: "DO-5"}


class AcademiaScraper:
    """Orchestrate scraping of all Academia data pages."""

    def __init__(self, cookie: str) -> None:
        self.cookie = cookie
        self.parser = AcademiaParser()
        self.timetable_builder = TimetableBuilder()

    def attendance(self) -> AttendanceResponse:
        html = self._fetch_page(settings.attendance_url)
        return self.parser.parse_attendance(html)

    def marks(self) -> MarksResponse:
        html = self._fetch_page(settings.attendance_url)
        return self.parser.parse_marks(html)

    def courses(self) -> CourseResponse:
        html = self._fetch_page(settings.course_url)
        return self.parser.parse_courses(html)

    def user(self) -> User:
        html = self._fetch_page(settings.course_url)
        return self.parser.parse_user(html)

    def timetable(self) -> TimetableResponse:
        courses = self.courses()
        user = self.user()
        try:
            batch = int(user.batch or "1")
        except ValueError:
            batch = 1

        schedule = self._unified_schedule(courses, batch)
        source = "unified"
        if not schedule:
            schedule = self.timetable_builder.build(courses, batch)
            source = "matrix"

        print(f"[SCRAPER] Timetable: {len(schedule)} slots from {source} (batch={batch})")
        return TimetableResponse(
            regNumber=user.regNumber or "",
            batch=user.batch or "",
            schedule=schedule,
            status=200,
        )

    def _unified_schedule(self, courses: CourseResponse, batch: int) -> list:
        """Build a timetable by matching course slot codes to the unified grid.

        Grid layout: (day_num, hour_num) → [slot_codes]
        Course slot field: "A", "L51-L52-", "A1+TA1", "L11-2", "P29-P30-"
        — tokenise on "+" and "-" so compound 2-hour blocks (L51+L52, P29+P30)
        and batch-suffixed slots (L11-2 → L11, 2) resolve against the grid.
        """
        from core.schemas.models import TimetableSlot

        # Merge duplicate course rows (same code can appear once per part:
        # e.g. theory "A" row + practical "P29-P30-" row for the same course).
        # Record which row declared each token so room/faculty come from the
        # right part — otherwise the practical would inherit the theory room.
        course_parts: dict[str, list[str]] = {}
        token_owner: dict[tuple[str, str], Course] = {}
        for course in courses.courses:
            if not course.code:
                continue
            tokens = []
            for group in (course.slot or "").rstrip("-").split("+"):
                for token in group.split("-"):
                    token = token.strip()
                    if token and not token.isdigit() and token != "X":
                        tokens.append(token)
            if not tokens:
                continue
            existing = course_parts.setdefault(course.code, [])
            for t in tokens:
                if t not in existing:
                    existing.append(t)
                    token_owner[(course.code, t)] = course

        targets = [(batch, False), (batch, True), (1, False), (2, False)]

        for try_batch, lower in targets:
            try:
                url = settings.unified_timetable_url(try_batch, lower=lower)
                html = self._fetch_page(url)
                parsed = self.parser.parse_unified_timetable(html)
            except Exception as e:
                print(f"[SCRAPER] unified timetable fetch failed (batch={try_batch}): {e}")
                parsed = {"grid": {}}

            grid = parsed.get("grid", {})
            times = parsed.get("times", {})
            if not grid:
                continue

            # Build reverse map: slot_code → [(day, hour)]
            slot_positions: dict[str, list[tuple[int, int]]] = {}
            for (day, hour), slot_codes in grid.items():
                for sc in slot_codes:
                    slot_positions.setdefault(sc, []).append((day, hour))

            schedule: list = []
            placed: set[tuple] = set()
            unmatched: list[str] = []

            for code, tokens in course_parts.items():
                for token in tokens:
                    owner = token_owner.get((code, token))
                    if not owner:
                        continue
                    positions = slot_positions.get(token)
                    if not positions:
                        # Token missing from the batch grid (e.g. tutorial
                        # slots "TA1" or section-specific codes) — fall back
                        # to the standard slot matrix so the class still
                        # shows up instead of silently vanishing.
                        positions = SLOT_MATRIX.get(normalize_token(token))
                    if not positions:
                        unmatched.append(f"{code}:{token}")
                        continue
                    for day, hour in positions:
                        day_name = DAY_NAMES.get(day, f"Day{day}")
                        key = (code, day_name, hour)
                        if key in placed:
                            continue
                        placed.add(key)
                        schedule.append(
                            TimetableSlot(
                                day=day_name,
                                hour=hour,
                                time=times.get(hour, ""),
                                courseCode=code,
                                courseTitle=owner.title,
                                slot=token,
                                faculty=owner.faculty,
                                room=owner.room,
                            )
                        )

            if schedule:
                day_order = {"DO-1": 0, "DO-2": 1, "DO-3": 2, "DO-4": 3, "DO-5": 4}
                schedule.sort(key=lambda s: (day_order.get(s.day, 99), s.hour))
                print(
                    f"[SCRAPER] unified grid {url.split('/')[-1]}: "
                    f"{len(grid)} cells, {len(schedule)} slots, "
                    f"unmatched: {unmatched or 'none'}"
                )
                return schedule

        return []

    def calendar(self) -> CalendarResponse:
        with AcademiaClient(cookie=self.cookie) as client:
            response = client.get(
                settings.calendar_url,
                headers={
                    "accept": "*/*",
                    "accept-language": "en-US,en;q=0.9",
                    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "Referer": f"{settings.academia_base_url}/",
                    "Cache-Control": "public, max-age=3600, stale-while-revalidate=7200",
                },
            )
        if response.status_code != 200:
            return CalendarResponse(
                error=True,
                message=f"HTTP error: {response.status_code}",
                status=response.status_code,
            )
        return self.parser.parse_calendar(response.text)

    def all_data(self) -> dict[str, Any]:
        """Fetch all data in parallel."""
        jobs = {
            "user": lambda: self.user().model_dump(),
            "attendance": lambda: self.attendance().model_dump(),
            "marks": lambda: self.marks().model_dump(),
            "courses": lambda: self.courses().model_dump(),
            "timetable": lambda: self.timetable().model_dump(),
        }
        payload: dict[str, Any] = {}
        with ThreadPoolExecutor(max_workers=5) as pool:
            futures = {pool.submit(func): key for key, func in jobs.items()}
            for future in as_completed(futures):
                key = futures[future]
                try:
                    payload[key] = future.result()
                except Exception as e:
                    payload[key] = {"error": str(e)}

        user = payload.get("user", {})
        if isinstance(user, dict) and user.get("regNumber"):
            payload["regNumber"] = user["regNumber"]
        return payload

    def _fetch_page(self, url: str) -> str:
        with AcademiaClient(cookie=self.cookie) as client:
            return client.fetch_page(url)
