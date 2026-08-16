from __future__ import annotations

import re
from datetime import datetime, timedelta

from bs4 import BeautifulSoup, Tag

from core.schemas.models import (
    Attendance,
    AttendanceResponse,
    CalendarDay,
    CalendarMonth,
    CalendarResponse,
    MarksResponse,
    Mark,
    MarksDetail,
    TestPerformance,
)


class StudentPortalParser:
    """Parse HTML responses from SRM Student Portal into structured data."""

    def parse_attendance(self, html: str) -> AttendanceResponse:
        """Parse attendance page HTML into structured attendance data."""
        soup = BeautifulSoup(html, "lxml")
        attendance_list: list[Attendance] = []

        # Find the main attendance table
        tables = soup.find_all("table")
        for table in tables:
            rows = table.find_all("tr")
            if len(rows) < 2:
                continue

            # Check if this is the attendance table by looking for header
            header_row = rows[0]
            headers = [th.get_text(strip=True).lower() for th in header_row.find_all(["th", "td"])]

            # Match attendance table headers
            if any("code" in h for h in headers) and any("hour" in h for h in headers):
                for row in rows[1:]:
                    cells = row.find_all("td")
                    if len(cells) < 6:
                        continue

                    code = cells[0].get_text(strip=True)
                    description = cells[1].get_text(strip=True)

                    # Skip summary/total rows
                    if not code or "total" in description.lower() or "sgpa" in code.lower():
                        continue

                    try:
                        max_hours = float(cells[2].get_text(strip=True))
                        att_hours = float(cells[3].get_text(strip=True))
                        absent_hours = float(cells[4].get_text(strip=True))
                        percentage = float(cells[5].get_text(strip=True).replace("%", ""))
                    except (ValueError, IndexError):
                        continue

                    attendance_list.append(Attendance(
                        courseCode=code,
                        courseTitle=description,
                        category="",
                        facultyName="",
                        slot="",
                        hoursConducted=max_hours,
                        hoursAbsent=absent_hours,
                        attendancePercentage=percentage,
                    ))

        return AttendanceResponse(
            regNumber="",
            attendance=attendance_list,
            status=200,
        )

    def parse_grades(self, html: str) -> dict:
        """Parse grade/mark page HTML into structured data."""
        soup = BeautifulSoup(html, "lxml")
        result = {
            "semesters": [],
            "cgpa": None,
            "credits_registered": None,
            "credits_earned": None,
            "credits_required": None,
        }

        tables = soup.find_all("table")
        for table in tables:
            rows = table.find_all("tr")
            if len(rows) < 2:
                continue

            # Check if this is the grade table
            header_row = rows[0]
            headers = [th.get_text(strip=True).lower() for th in header_row.find_all(["th", "td"])]

            if "semester" in headers and "grade" in headers:
                current_semester = None
                semester_grades: list[dict] = []

                for row in rows[1:]:
                    cells = row.find_all("td")
                    text = row.get_text(strip=True).lower()

                    # SGPA row
                    if "sgpa" in text and len(cells) >= 2:
                        sgpa_text = cells[-1].get_text(strip=True).replace("sgpa", "").strip()
                        try:
                            sgpa = float(sgpa_text)
                        except ValueError:
                            sgpa = None

                        if current_semester is not None:
                            result["semesters"].append({
                                "semester": current_semester,
                                "sgpa": sgpa,
                                "grades": semester_grades,
                            })
                        semester_grades = []
                        current_semester = None
                        continue

                    # CGPA row
                    if "cgpa" in text and len(cells) >= 2:
                        cgpa_text = cells[-1].get_text(strip=True).replace("cgpa", "").strip()
                        try:
                            result["cgpa"] = float(cgpa_text)
                        except ValueError:
                            pass
                        continue

                    # Grade row
                    if len(cells) >= 6:
                        try:
                            sem = cells[0].get_text(strip=True)
                            if sem and sem.isdigit():
                                current_semester = int(sem)
                        except (ValueError, IndexError):
                            pass

                        code = cells[2].get_text(strip=True)
                        description = cells[3].get_text(strip=True)
                        credit = cells[4].get_text(strip=True)
                        grade = cells[5].get_text(strip=True)

                        if code and grade:
                            semester_grades.append({
                                "code": code,
                                "description": description,
                                "credit": credit,
                                "grade": grade,
                            })

            # Credit details table
            if "credits registered" in str(table).lower():
                for row in rows:
                    cells = row.find_all("td")
                    if len(cells) >= 2:
                        label = cells[0].get_text(strip=True).lower()
                        value = cells[1].get_text(strip=True)
                        if "registered" in label:
                            try:
                                result["credits_registered"] = int(value)
                            except ValueError:
                                pass
                        elif "earned" in label:
                            try:
                                result["credits_earned"] = int(value)
                            except ValueError:
                                pass
                        elif "required" in label:
                            try:
                                result["credits_required"] = int(value)
                            except ValueError:
                                pass

        return result

    def parse_internal_marks(self, html: str) -> list[dict]:
        """Parse internal marks page HTML."""
        soup = BeautifulSoup(html, "lxml")
        marks_list: list[dict] = []

        tables = soup.find_all("table")
        for table in tables:
            rows = table.find_all("tr")
            if len(rows) < 2:
                continue

            header_row = rows[0]
            headers = [th.get_text(strip=True).lower() for th in header_row.find_all(["th", "td"])]

            if "code" in headers and "mark" in str(headers):
                for row in rows[1:]:
                    cells = row.find_all("td")
                    if len(cells) < 3:
                        continue

                    code = cells[0].get_text(strip=True)
                    description = cells[1].get_text(strip=True)
                    mark_text = cells[2].get_text(strip=True)

                    # Parse "45/50" format
                    if "/" in mark_text:
                        parts = mark_text.split("/")
                        scored = parts[0].strip()
                        max_mark = parts[1].strip()
                    else:
                        scored = mark_text
                        max_mark = ""

                    if code:
                        marks_list.append({
                            "code": code,
                            "description": description,
                            "scored": scored,
                            "maxMark": max_mark,
                        })

        return marks_list

    def parse_attendance_detail(self, html: str) -> list[dict[str, str]]:
        """Parse attendance detail (absent drill-down) HTML into date records."""
        soup = BeautifulSoup(html, "lxml")
        records: list[dict[str, str]] = []

        tables = soup.find_all("table")
        for table in tables:
            rows = table.find_all("tr")
            if len(rows) < 2:
                continue

            header_row = rows[0]
            headers = [th.get_text(strip=True).lower() for th in header_row.find_all(["th", "td"])]

            if any("date" in h for h in headers) and any("hour" in h for h in headers):
                for row in rows[1:]:
                    cells = row.find_all("td")
                    if len(cells) < 3:
                        continue

                    date = cells[0].get_text(strip=True)
                    hour = cells[1].get_text(strip=True)
                    status = cells[2].get_text(strip=True) if len(cells) > 2 else ""

                    if date:
                        records.append({
                            "date": date,
                            "hour": hour,
                            "status": status,
                        })

        return records

    def parse_internal_marks_detail(self, html: str) -> list[dict[str, str]]:
        """Parse internal marks detail (component breakdown) HTML."""
        soup = BeautifulSoup(html, "lxml")
        components: list[dict[str, str]] = []

        tables = soup.find_all("table")
        for table in tables:
            rows = table.find_all("tr")
            if len(rows) < 2:
                continue

            header_row = rows[0]
            headers = [th.get_text(strip=True).lower() for th in header_row.find_all(["th", "td"])]

            if any("component" in h or "test" in h or "mark" in h for h in headers):
                for row in rows[1:]:
                    cells = row.find_all("td")
                    if len(cells) < 2:
                        continue

                    component = cells[0].get_text(strip=True)
                    mark_text = cells[1].get_text(strip=True)

                    # Parse "45/50" format
                    if "/" in mark_text:
                        parts = mark_text.split("/")
                        scored = parts[0].strip()
                        max_mark = parts[1].strip()
                    else:
                        scored = mark_text
                        max_mark = ""

                    if component:
                        components.append({
                            "component": component,
                            "scored": scored,
                            "maxMark": max_mark,
                        })

        return components

    def parse_academic_calendar(self, html: str) -> CalendarResponse:
        """Parse the SP Academic Calender/Planner inner page.

        Table columns: DATE | DAY | STATUS | WEEK | DAY ORDER | REMARKS
        """
        soup = BeautifulSoup(html, "lxml")
        days: list[CalendarDay] = []
        working = holidays = total = None

        # Stats bar (text like "94 No. of Working days 46 No. of Holidays 140 Total days")
        text = soup.get_text(" ", strip=True)
        m = re.search(r"(\d+)\s*No\.?\s*of\s*Working\s*days", text, re.I)
        if m:
            working = int(m.group(1))
        m = re.search(r"(\d+)\s*No\.?\s*of\s*Holidays", text, re.I)
        if m:
            holidays = int(m.group(1))
        m = re.search(r"(\d+)\s*Total\s*days", text, re.I)
        if m:
            total = int(m.group(1))

        for row in soup.find_all("tr"):
            cells = row.find_all("td")
            if len(cells) < 6:
                continue
            date_txt = cells[0].get_text(strip=True)
            if not re.match(r"\d{2}-\d{2}-\d{4}", date_txt):
                continue
            day_name = cells[1].get_text(strip=True)
            status = cells[2].get_text(" ", strip=True)
            week = cells[3].get_text(strip=True)
            day_order = cells[4].get_text(strip=True)
            remarks = cells[5].get_text(" ", strip=True)

            # Merge into a single label: "Wk 4 · Day 5 · Working day"
            parts = [p for p in (week, day_order, status) if p and p != "-"]
            merged = " · ".join(parts)
            days.append(CalendarDay(
                date=date_txt,
                day=day_name,
                event=remarks if remarks and remarks != "-" else status,
                dayOrder=merged,
            ))

        if not days:
            return CalendarResponse(status=200, error=True, message="No calendar rows found")

        # Group into months (Jul, Aug, ...)
        months: dict[str, list[CalendarDay]] = {}
        for d in days:
            try:
                month_name = datetime.strptime(d.date, "%d-%m-%Y").strftime("%B")
            except ValueError:
                month_name = "Unknown"
            months.setdefault(month_name, []).append(d)

        month_list = [
            CalendarMonth(month=m, days=month_days)
            for m, month_days in sorted(
                months.items(),
                key=lambda kv: datetime.strptime(kv[0], "%B") if kv[0] != "Unknown" else datetime(2100, 1, 1),
            )
        ]

        today = tomorrow = None
        try:
            today_dt = datetime.now()
            today_str = today_dt.strftime("%d-%m-%Y")
            tomorrow_str = (today_dt + timedelta(days=1)).strftime("%d-%m-%Y")
            for d in days:
                if d.date == today_str:
                    today = d
                if d.date == tomorrow_str:
                    tomorrow = d
        except Exception:
            pass

        return CalendarResponse(
            status=200,
            today=today,
            tomorrow=tomorrow,
            index=len(days),
            calendar=month_list,
            error=False,
        )

    def parse_marks_for_academia(self, html: str) -> MarksResponse:
        """Parse grades into MarksResponse format for API compatibility."""
        grades = self.parse_grades(html)
        marks_list: list[Mark] = []

        for sem in grades.get("semesters", []):
            for g in sem.get("grades", []):
                marks_list.append(Mark(
                    courseName=g.get("description", ""),
                    courseCode=g.get("code", ""),
                    courseType="",
                    overall=MarksDetail(scored=g.get("grade", ""), total=""),
                    testPerformance=[],
                ))

        return MarksResponse(
            regNumber="",
            marks=marks_list,
            status=200,
        )
