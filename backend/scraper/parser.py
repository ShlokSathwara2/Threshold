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

            siblings = _next_cells(cell)
            if len(siblings) < 7:
                continue

            conducted = siblings[5].get_text(strip=True)
            absent = siblings[6].get_text(strip=True)
            conducted_hours = _parse_float(conducted)
            absent_hours = _parse_float(absent)
            percentage = (
                ((conducted_hours - absent_hours) / conducted_hours * 100)
                if conducted_hours
                else 0.0
            )
            title = siblings[0].get_text(strip=True).split(" \u2013")[0]
            if title.lower() == "null":
                continue

            attendance.append(
                Attendance(
                    courseCode=course_code.replace("Regular", ""),
                    courseTitle=title,
                    category=siblings[1].get_text(strip=True),
                    facultyName=siblings[2].get_text(strip=True),
                    slot=siblings[3].get_text(strip=True),
                    hoursConducted=conducted_hours,
                    hoursAbsent=absent_hours,
                    attendancePercentage=round(percentage, 2),
                )
            )

        return AttendanceResponse(regNumber=reg_number, attendance=attendance, status=200)

    def parse_marks(self, page_html: str) -> MarksResponse:
        attendance = self.parse_attendance(page_html)
        course_map = {
            entry.courseCode: entry.courseTitle for entry in attendance.attendance
        }

        marks_html = extract_section_html(page_html, "marks")
        if not marks_html:
            return MarksResponse(regNumber=attendance.regNumber, marks=[], status=200)

        soup = BeautifulSoup(marks_html, "lxml")
        marks: list[Mark] = []

        for table in soup.find_all("table"):
            for row in table.find_all("tr"):
                cells = row.find_all("td", recursive=False)
                if len(cells) < 3:
                    continue

                course_code = cells[0].get_text(strip=True)
                course_type = cells[1].get_text(strip=True)
                performances: list[TestPerformance] = []
                overall_scored = 0.0
                overall_total = 0.0

                for test_cell in cells[2].select("table td"):
                    text = test_cell.get_text(strip=True)
                    pieces = text.split(".00")
                    if len(pieces) < 2:
                        continue
                    name_parts = pieces[0].split("/")
                    if len(name_parts) < 2:
                        continue
                    test_title = name_parts[0]
                    total = _parse_float(name_parts[1])
                    scored_str = pieces[1]
                    scored = _parse_float(scored_str)

                    performances.append(
                        TestPerformance(
                            test=test_title,
                            marks=MarksDetail(
                                scored="Abs" if scored_str == "Abs" else f"{scored:.2f}",
                                total=f"{total:.2f}",
                            ),
                        )
                    )
                    if scored_str != "Abs":
                        overall_scored += scored
                    overall_total += total

                marks.append(
                    Mark(
                        courseName=course_map.get(course_code, ""),
                        courseCode=course_code,
                        courseType=course_type,
                        overall=MarksDetail(
                            scored=f"{overall_scored:.2f}",
                            total=f"{overall_total:.2f}",
                        ),
                        testPerformance=performances,
                    )
                )

        # Order: Theory first, then Practical
        ordered = [m for m in marks if m.courseType == "Theory"]
        ordered.extend(m for m in marks if m.courseType != "Theory")
        return MarksResponse(regNumber=attendance.regNumber, marks=ordered, status=200)

    def parse_courses(self, page_html: str) -> CourseResponse:
        reg_number = extract_reg_number(page_html)
        table_html = extract_section_html(page_html, "course")
        if not table_html:
            return CourseResponse(regNumber=reg_number, courses=[], status=200)

        soup = BeautifulSoup(table_html, "lxml")
        courses: list[Course] = []

        for index, row in enumerate(soup.find_all("tr")):
            if index == 0:
                continue
            cells = row.find_all("td")
            course = self._parse_course_row(cells)
            if course:
                courses.append(course)

        return CourseResponse(regNumber=reg_number, courses=courses, status=200)

    def parse_user(self, page_html: str) -> User:
        table_html = extract_section_html(page_html, "user")
        reg_number = extract_reg_number(page_html)
        user = User(regNumber=reg_number)

        if not table_html:
            return user

        soup = BeautifulSoup(table_html, "lxml")
        now = datetime.now()

        for row in soup.find_all("tr"):
            cells = row.find_all("td")
            for index in range(0, len(cells), 2):
                if index + 1 >= len(cells):
                    continue
                key = cells[index].get_text(strip=True).removesuffix(":")
                value_cell = cells[index + 1]
                value = value_cell.get_text(strip=True)

                if key == "Name":
                    user.name = value
                elif key == "Program":
                    user.program = value
                elif key == "Combo / Batch":
                    font = value_cell.find("font")
                    user.batch = font.get_text(strip=True) if font else value
                elif key == "Mobile":
                    user.mobile = value
                elif key == "Semester":
                    user.semester = _parse_int(value)
                elif key == "Department":
                    parts = value.split("-", 1)
                    user.department = parts[0].strip()
                    if len(parts) > 1:
                        user.section = (
                            parts[1].strip().removeprefix("(").removesuffix(" Section)")
                        )

        # Calculate year from reg number
        if reg_number and len(reg_number) >= 4:
            admission_year = _parse_int(reg_number[2:4])
            academic_year = now.year % 100
            if now.month >= 7:
                academic_year += 1
            user.year = academic_year - admission_year
            if admission_year > now.year % 100:
                user.year -= 1

        return user

    def parse_calendar(self, response_html: str, today: datetime | None = None) -> CalendarResponse:
        now = today or datetime.now()

        # Handle hex-encoded calendar pages
        if "zmlvalue=" in response_html:
            parts = response_html.split('zmlvalue="', 1)
            if len(parts) >= 2:
                encoded = parts[1].split('" > </div>', 1)[0]
                html_text = decode_hex_html(encoded)
            else:
                return CalendarResponse(error=True, message="Invalid calendar format", status=500)
        else:
            html_text = response_html

        soup = BeautifulSoup(html_text, "lxml")
        headers = [
            heading.get_text(strip=True)
            for heading in soup.find_all("th")
            if "'2" in heading.get_text()
        ]
        months = [CalendarMonth(month=header, days=[]) for header in headers]

        for row in soup.select("table tr"):
            cells = row.find_all("td")
            for index, month in enumerate(months):
                offset = index * 5 if index > 0 else 0
                if len(cells) <= offset + 3:
                    continue
                date = cells[offset].get_text(strip=True)
                day = cells[offset + 1].get_text(strip=True)
                event = cells[offset + 2].get_text(strip=True)
                day_order = cells[offset + 3].get_text(strip=True)
                if date and day_order:
                    month.days.append(
                        CalendarDay(date=date, day=day, event=event, dayOrder=day_order)
                    )

        # Sort months chronologically
        month_order = {
            name: i for i, name in enumerate(
                ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                 "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            )
        }
        months.sort(key=lambda m: month_order.get(m.month.split("'")[0][:3], 99))
        for month in months:
            month.days.sort(key=lambda d: _parse_int(d.date))

        # Find today/tomorrow
        current_name = now.strftime("%b")
        month_index = next(
            (i for i, m in enumerate(months) if current_name in m.month), 0
        )
        today_day = None
        tomorrow_day = None

        if months and month_index < len(months):
            current_month = months[month_index]
            if current_month.days:
                today_idx = now.day - 1
                if 0 <= today_idx < len(current_month.days):
                    today_day = current_month.days[today_idx]
                    tomorrow_idx = today_idx + 1
                    if tomorrow_idx < len(current_month.days):
                        tomorrow_day = current_month.days[tomorrow_idx]
                    elif month_index + 1 < len(months) and months[month_index + 1].days:
                        tomorrow_day = months[month_index + 1].days[0]

        return CalendarResponse(
            status=200,
            today=today_day,
            tomorrow=tomorrow_day,
            index=month_index,
            calendar=months,
        )

    @staticmethod
    def parse_unified_timetable(self, html: str) -> list[dict]:
        """Parse the unified batch timetable grid into rows.

        Format: rows = slot codes (e.g. "A1", "L3-1"), columns = days
        (Mon..Fri), each cell holds the course that occupies that slot.
        Returns [{"slot": "A1", "cells": {"Mon": "21CSC202J - ...", ...}}, ...]
        """
        soup = BeautifulSoup(html, "lxml")
        day_map = {
            "mon": "Mon", "tue": "Tue", "wed": "Wed", "thu": "Thu", "fri": "Fri",
        }

        for table in soup.find_all("table"):
            rows = table.find_all("tr")
            if len(rows) < 2:
                continue

            header_cells = rows[0].find_all(["th", "td"])
            headers = [c.get_text(strip=True).lower() for c in header_cells]
            day_cols: list[tuple[int, str]] = []
            for i, h in enumerate(headers):
                for key, name in day_map.items():
                    if h.startswith(key):
                        day_cols.append((i, name))
                        break
            if not day_cols:
                continue

            grid: list[dict] = []
            for row in rows[1:]:
                cells = row.find_all(["td", "th"])
                if not cells:
                    continue
                slot = cells[0].get_text(strip=True)
                if not slot or not slot[0].isalpha():
                    continue
                entry: dict = {"slot": slot, "cells": {}}
                for col_index, day_name in day_cols:
                    if col_index < len(cells):
                        text = " ".join(cells[col_index].get_text(" ", strip=True).split())
                        if text:
                            entry["cells"][day_name] = text
                if entry["cells"]:
                    grid.append(entry)

            if len(grid) >= 3:
                return grid

        return []

    def _parse_course_row(cells) -> Course | None:
        if len(cells) < 11:
            return None

        values = [cell.get_text(strip=True) for cell in cells]
        room = values[9] or "N/A"
        if room != "N/A":
            room = room[:1].upper() + room[1:]
        slot = values[8].removesuffix("-")

        return Course(
            code=values[1],
            title=values[2].split(" \u2013")[0],
            credit=values[3] or "N/A",
            category=values[4],
            courseCategory=values[5],
            type=values[6] or "N/A",
            slotType="Practical" if "P" in slot else "Theory",
            faculty=values[7] or "N/A",
            slot=slot,
            room=room,
            academicYear=values[10],
        )


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
