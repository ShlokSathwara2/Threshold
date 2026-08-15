from __future__ import annotations

from typing import Any

import httpx

from core.config import settings
from core.schemas.models import (
    AttendanceResponse,
    MarksResponse,
)
from scraper.student_portal.parser import StudentPortalParser


class StudentPortalScraper:
    """Orchestrate scraping of all Student Portal data pages."""

    def __init__(self, cookie: str) -> None:
        self.cookie = cookie
        self.parser = StudentPortalParser()

    def _get_client(self) -> httpx.Client:
        """Create an httpx client with session cookies loaded."""
        client = httpx.Client(
            timeout=30,
            follow_redirects=True,
            verify=False,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "X-Requested-With": "XMLHttpRequest",
                "Referer": f"{settings.sp_base_url}{settings.sp_context_path}/students/template/HRDSystem.jsp",
            },
        )
        for pair in self.cookie.split(";"):
            pair = pair.strip()
            if "=" in pair:
                k, v = pair.split("=", 1)
                client.cookies.set(k.strip(), v.strip())
        return client

    def attendance(self) -> AttendanceResponse:
        """Fetch and parse attendance data from Student Portal."""
        url = settings.sp_attendance_url
        with self._get_client() as client:
            response = client.post(url, data="")
            print(f"[SP-SCRAPER] Attendance URL: {url}")
            print(f"[SP-SCRAPER] Attendance status: {response.status_code}")
            print(f"[SP-SCRAPER] Attendance snippet: {response.text[:300]}")

            if response.status_code != 200:
                return AttendanceResponse(
                    regNumber="",
                    attendance=[],
                    status=response.status_code,
                    error=f"HTTP {response.status_code}",
                )

            return self.parser.parse_attendance(response.text)

    def marks(self) -> MarksResponse:
        """Fetch and parse marks/grades from Student Portal."""
        url = settings.sp_grades_url
        with self._get_client() as client:
            response = client.post(url, data="")
            print(f"[SP-SCRAPER] Grades URL: {url}")
            print(f"[SP-SCRAPER] Grades status: {response.status_code}")
            print(f"[SP-SCRAPER] Grades snippet: {response.text[:300]}")

            if response.status_code != 200:
                return MarksResponse(
                    regNumber="",
                    marks=[],
                    status=response.status_code,
                    error=f"HTTP {response.status_code}",
                )

            return self.parser.parse_marks_for_academia(response.text)

    def grades(self) -> dict:
        """Fetch and parse detailed grades (with SGPA/CGPA)."""
        url = settings.sp_grades_url
        with self._get_client() as client:
            response = client.post(url, data="")
            print(f"[SP-SCRAPER] Grades URL: {url}")
            print(f"[SP-SCRAPER] Grades status: {response.status_code}")
            print(f"[SP-SCRAPER] Grades snippet: {response.text[:300]}")

            if response.status_code != 200:
                return {"error": f"HTTP {response.status_code}"}

            return self.parser.parse_grades(response.text)

    def internal_marks(self) -> list[dict]:
        """Fetch and parse internal marks from Student Portal."""
        url = settings.sp_internal_marks_url
        with self._get_client() as client:
            response = client.post(url, data="")
            print(f"[SP-SCRAPER] Internal marks URL: {url}")
            print(f"[SP-SCRAPER] Internal marks status: {response.status_code}")
            print(f"[SP-SCRAPER] Internal marks snippet: {response.text[:300]}")

            if response.status_code != 200:
                return []

            return self.parser.parse_internal_marks(response.text)

    def all_data(self) -> dict[str, Any]:
        """Fetch all available data from Student Portal."""
        payload: dict[str, Any] = {}

        try:
            payload["attendance"] = self.attendance().model_dump()
        except Exception as e:
            payload["attendance"] = {"error": str(e)}

        try:
            payload["grades"] = self.grades()
        except Exception as e:
            payload["grades"] = {"error": str(e)}

        try:
            payload["marks"] = self.marks().model_dump()
        except Exception as e:
            payload["marks"] = {"error": str(e)}

        try:
            payload["internal_marks"] = self.internal_marks()
        except Exception as e:
            payload["internal_marks"] = {"error": str(e)}

        return payload
