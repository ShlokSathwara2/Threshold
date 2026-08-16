from __future__ import annotations

import re
from datetime import datetime

from bs4 import BeautifulSoup

from core.markup import (
    decode_hex_html,
    extract_reg_number,
    extract_section_html,
)
from core.schemas.models import (
    Attendance,
    AttendanceResponse,
    CalendarDay,
    CalendarMonth,
    CalendarResponse,
    Course,
    CourseResponse,
    Mark,
    MarksDetail,
    MarksResponse,
    TestPerformance,
    User,
)


class AcademiaParser:
    """Parse raw HTML from Academia into structured data."""

    def parse_attendance(self, page_html: str) -> AttendanceResponse:
        reg_number = extract_reg_number(page_html)
        table_html = extract_section_html(page_html, "attendance")
        if not table_html:
            return AttendanceResponse(regNumber=reg_number, attendance=[], status=200)

        soup = BeautifulSoup(table_html, "lxml")
        cells = [
            cell
            for cell in soup.select("td[bgcolor='#E6E6FA']")
            if cell.get_text(strip=True) != " - "
        ]
        attendance: list[Attendance] = []

        for cell in cells:
            course_code = cell.get_text(strip=True)
            if not (
                (len(course_code) > 10 and course_code[:1].isdigit())
                or "regular" in course_code.lower()
            ):
                continue
            row = cell.find_parent("tr")
            if not row:
                continue
            cols = [c.get_text(strip=True) for c in row.find_all("td")]
            if len(cols) < 9:
                continue

            total = _parse_int(cols[4])
            attended = _parse_int(cols[5])
            pct = _parse_float(cols[7].replace("%", ""))
            can_bunk = max(0, total - int(attended / 0.75)) if pct >= 75 else 0
            must_attend = max(0, int((0.75 * total - attended) / 0.25)) if pct < 75 else 0

            attendance.append(
                Attendance(
                    courseCode=course_code,
                    courseTitle=cols[2] if len(cols) > 2 else "",
                    category=cols[1] if len(cols) > 1 else "",
                    slot=cols[3] if len(cols) > 3 else "",
                    totalClasses=total,
                    attended=attended,
                    percentage=round(pct, 1),
                    canBunk=can_bunk,
                    mustAttend=must_attend,
                )
            )
        return AttendanceResponse(
            regNumber=reg_number, attendance=attendance, status=200
        )

    def parse_marks(self, page_html: str) -> MarksResponse:
        reg_number = extract_reg_number(page_html)
        table_html = extract_section_html(page_html, "attendance")
        if not table_html:
            return MarksResponse(regNumber=reg_number, marks=[], status=200)

        soup = BeautifulSoup(table_html, "lxml")
        cells = soup.select("td[bgcolor='#E6E6FA']")

        marks_map: dict[str, Mark] = {}
        for cell in cells:
            course_code = cell.get_text(strip=True)
            if not (len(course_code) > 10 and course_code[:1].isdigit()):
                continue
            row = cell.find_parent("tr")
            if not row:
                continue
            cols = [c.get_text(strip=True) for c in row.find_all("td")]
            if len(cols) < 9:
                continue

            mark = marks_map.setdefault(
                course_code,
                Mark(
                    courseCode=course_code,
                    courseTitle=cols[2] if len(cols) > 2 else "",
                    slot=cols[3] if len(cols) > 3 else "",
                    details=[],
                ),
            )

            test_name = cols[6] if len(cols) > 6 else ""
            if test_name:
                mark.details.append(
                    MarksDetail(
                        testName=test_name,
                        internalMark=_parse_float(cols[7]),
                        externalMark=_parse_float(cols[8]) if len(cols) > 8 else 0.0,
                        totalMark=_parse_float(cols[4]),
                        weightage=_parse_float(cols[5]),
                    )
                )

        return MarksResponse(
            regNumber=reg_number,
            marks=list(marks_map.values()),
            status=200,
        )

    def parse_courses(self, page_html: str) -> CourseResponse:
        soup = BeautifulSoup(page_html, "lxml")
        rows = soup.select("table tr")
        courses: list[Course] = []
        seen: set[str] = set()

        for row in rows:
            cells = row.find_all("td")
            if len(cells) < 11:
                continue
            course = self._parse_course_row(cells)
            if course and course.code not in seen:
                seen.add(course.code)
                courses.append(course)

        return CourseResponse(courses=courses, status=200)

    def parse_user(self, page_html: str) -> User:
        soup = BeautifulSoup(page_html, "lxml")
        text = soup.get_text(" ", strip=True)

        reg = ""
        batch = ""
        section = ""
        name = ""

        m = re.search(r"Reg\.?\s*(?:No|Number)\s*[:.\-]?\s*(RA\d+)", text, re.I)
        if m:
            reg = m.group(1)

        m = re.search(r"Batch\s*[:.\-]?\s*(\d+)", text, re.I)
        if m:
            batch = m.group(1)

        m = re.search(r"Section\s*[:.\-]?\s*([A-Z])", text, re.I)
        if m:
            section = m.group(1)

        m = re.search(r"(?:Name|Student\s*Name)\s*[:.\-]?\s*([A-Z][A-Za-z\s]+?)(?:\s{2,}|\bReg|\bBatch|\bSection)", text)
        if m:
            name = m.group(1).strip()

        return User(
            regNumber=reg,
            batch=batch,
            section=section,
            name=name,
        )

    def parse_calendar(self, page_html: str) -> CalendarResponse:
        soup = BeautifulSoup(page_html, "lxml")
        months: list[CalendarMonth] = []

        for table in soup.find_all("table"):
            caption = table.find("caption")
            if not caption:
                continue
            title = caption.get_text(strip=True)
            m = re.search(r"(\w+)\s+(\d{4})", title)
            if not m:
                continue
            month_name, year = m.group(1), m.group(2)

            rows = table.find_all("tr")
            days: list[CalendarDay] = []
            for row in rows:
                cells = row.find_all("td")
                for cell in cells:
                    day_num = _parse_int(cell.get_text(strip=True))
                    if day_num < 1 or day_num > 31:
                        continue
                    bg = cell.get("bgcolor", "")
                    cell_type = "holiday" if bg.upper() in ("#FF0000", "RED") else "working"
                    try:
                        dt = datetime.strptime(f"{month_name} {day_num} {year}", "%B %d %Y")
                    except ValueError:
                        continue
                    days.append(
                        CalendarDay(
                            date=dt.strftime("%Y-%m-%d"),
                            day=day_num,
                            type=cell_type,
                            dayOfWeek=dt.strftime("%A"),
                        )
                    )
            if days:
                months.append(CalendarMonth(month=month_name, year=int(year), days=days))

        return CalendarResponse(error=False, calendar=months, status=200)

    @staticmethod
    def parse_unified_timetable(html: str) -> dict:
        """Parse the unified batch timetable grid.

        The grid layout (from screenshot):
          - Rows = Day 1..5
          - Columns = Hour 1..12
          - Cells = slot codes (e.g. "A", "A / X", "P6", "L11")

        Returns {"grid": {(day_num, hour_num): [slot_codes]}, "raw": [(day, hour, cell_text)]}
        """
        soup = BeautifulSoup(html, "lxml")

        for table in soup.find_all("table"):
            rows = table.find_all("tr")
            if len(rows) < 4:
                continue

            hour_labels = []
            grid: dict[tuple[int, int], list[str]] = {}
            raw: list[tuple[int, int, str]] = []
            day_num = 0

            for row in rows:
                cells = row.find_all(["td", "th"])
                texts = [c.get_text(strip=True) for c in cells]
                if not texts:
                    continue

                first = texts[0].strip().lower()

                # Hour order header row
                if "hour" in first or "order" in first:
                    hour_labels = texts[1:]  # skip "Hour/Day Order"
                    continue

                # Time rows (FROM/TO) — skip
                if first in ("from", "to"):
                    continue

                # Day rows
                if first.startswith("day"):
                    dm = re.search(r"day\s+(\d+)", first)
                    if not dm:
                        continue
                    day_num = int(dm.group(1))
                    data_cells = texts[1:]  # skip "Day N" label
                    for hi, cell_text in enumerate(data_cells):
                        hour = hi + 1
                        if not cell_text:
                            continue
                        # Split "A / X" → ["A", "X"]
                        parts = [p.strip() for p in cell_text.replace("/", " / ").split(" / ") if p.strip()]
                        grid[(day_num, hour)] = parts
                        raw.append((day_num, hour, cell_text))
                    continue

            if grid:
                return {"grid": grid, "raw": raw}

        return {"grid": {}, "raw": []}


def extract_course_code(text: str) -> str:
    """Extract an SRM course code (e.g. 21CSC202J) from timetable cell text."""
    if not text:
        return ""
    m = re.search(r"\b\d{2}[A-Z]{2,}\d{3}[A-Z]?\b", text)
    return m.group(0) if m else ""


def _next_cells(cell) -> list:
    siblings = []
    for sibling in cell.next_siblings:
        if hasattr(sibling, "name") and sibling.name == "td":
            siblings.append(sibling)
    return siblings


def _parse_float(s: str) -> float:
    try:
        return float(s)
    except (ValueError, TypeError):
        return 0.0


def _parse_int(s: str) -> int:
    try:
        return int(s)
    except (ValueError, TypeError):
        return 0
