from __future__ import annotations

from bs4 import BeautifulSoup, Tag

from core.schemas.models import (
    Attendance,
    AttendanceResponse,
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
