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
from scraper.timetable import TimetableBuilder


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

        return TimetableResponse(
            regNumber=user.regNumber or "",
            batch=user.batch or "",
            schedule=schedule,
            status=200,
        )

    def _unified_schedule(self, courses: CourseResponse, batch: int) -> list:
        """Build a timetable from the Unified_Time_Table grid for the student's batch."""
        from core.schemas.models import TimetableSlot
        from scraper.timetable import DAY_NAMES, SLOT_MATRIX, TimetableBuilder

        course_by_code = {c.code: c for c in courses.courses if c.code}
        targets = [(batch, False), (batch, True), (1, False), (2, False)]

        for try_batch, lower in targets:
            try:
                url = settings.unified_timetable_url(try_batch, lower=lower)
                html = self._fetch_page(url)
                grid = self.parser.parse_unified_timetable(html)
            except Exception as e:
                print(f"[SCRAPER] unified timetable fetch failed (batch={try_batch}): {e}")
                grid = []

            if not grid:
                continue

            schedule: list = []
            placed: set[tuple] = set()
            for entry in grid:
                slot = entry["slot"].rstrip("-")
                if slot.startswith("L") and not TimetableBuilder._batch_matches(slot, batch):
                    continue
                base_slot = slot.split("-")[0]
                time_slots = SLOT_MATRIX.get(base_slot, [])
                if not time_slots:
                    continue
                for cell_text in entry["cells"].values():
                    code = extract_course_code(cell_text)
                    course = course_by_code.get(code) if code else None
                    if not course:
                        continue
                    for day, hour in time_slots:
                        key = (course.code, DAY_NAMES.get(day, f"Day{day}"), hour)
                        if key in placed:
                            continue
                        placed.add(key)
                        schedule.append(
                            TimetableSlot(
                                day=DAY_NAMES.get(day, f"Day{day}"),
                                hour=hour,
                                courseCode=course.code,
                                courseTitle=course.title,
                                slot=slot,
                                faculty=course.faculty,
                                room=course.room,
                            )
                        )
            if schedule:
                day_order = {"Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4}
                schedule.sort(key=lambda s: (day_order.get(s.day, 99), s.hour))
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
