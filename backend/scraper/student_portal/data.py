from __future__ import annotations

import base64
import re
from typing import Any

import httpx
from bs4 import BeautifulSoup

from core.config import settings
from core.schemas.models import AttendanceResponse
from scraper.student_portal.parser import StudentPortalParser


def _build_client(cookie: str) -> httpx.Client:
    """Create an httpx client with session cookies loaded."""
    client = httpx.Client(
        timeout=30,
        follow_redirects=True,
        verify=False,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": f"{settings.sp_base_url}{settings.sp_context_path}/students/template/HRDSystem.jsp",
        },
    )
    for pair in cookie.split(";"):
        pair = pair.strip()
        if "=" in pair:
            k, v = pair.split("=", 1)
            client.cookies.set(k.strip(), v.strip())
    return client


def _init_session(client: httpx.Client) -> None:
    """Load the main dashboard to initialize the SPA session."""
    url = f"{settings.sp_base_url}{settings.sp_context_path}/students/template/HRDSystem.jsp"
    client.post(url, data="")


def fetch_attendance(cookie: str) -> AttendanceResponse:
    """POST studentAttendanceDetails.jsp and parse into AttendanceResponse."""
    print("[SP-DATA] fetch_attendance — cookie present:", bool(cookie))

    client = _build_client(cookie)
    try:
        _init_session(client)
        response = client.post(settings.sp_attendance_url, data="")
        print(f"[SP-DATA] attendance status: {response.status_code}")

        if response.status_code != 200:
            print(f"[SP-DATA] attendance parse failure: HTTP {response.status_code}")
            return AttendanceResponse(
                regNumber="",
                attendance=[],
                status=response.status_code,
                error=f"HTTP {response.status_code}",
            )

        parser = StudentPortalParser()
        result = parser.parse_attendance(response.text)
        print(f"[SP-DATA] attendance parse success: {len(result.attendance)} subjects")
        return result
    except Exception as e:
        print(f"[SP-DATA] attendance exception: {e}")
        return AttendanceResponse(
            regNumber="",
            attendance=[],
            status=500,
            error=str(e),
        )
    finally:
        client.close()


def fetch_attendance_detail(
    cookie: str, subject_id: str, month: int, year: int
) -> list[dict[str, str]]:
    """POST studentAttendanceDetailsInner.jsp and parse absent-date records."""
    print(f"[SP-DATA] fetch_attendance_detail — subject_id={subject_id}, month={month}, year={year}")

    client = _build_client(cookie)
    try:
        _init_session(client)
        response = client.post(
            settings.sp_attendance_detail_url,
            data={
                "ids": subject_id,
                "attendanceMonth": str(month),
                "attendanceYear": str(year),
            },
        )
        print(f"[SP-DATA] attendance-detail status: {response.status_code}")

        if response.status_code != 200:
            print(f"[SP-DATA] attendance-detail parse failure: HTTP {response.status_code}")
            return []

        parser = StudentPortalParser()
        records = parser.parse_attendance_detail(response.text)
        print(f"[SP-DATA] attendance-detail parse success: {len(records)} records")
        return records
    except Exception as e:
        print(f"[SP-DATA] attendance-detail exception: {e}")
        return []
    finally:
        client.close()


def fetch_marks_credits(cookie: str) -> dict[str, Any]:
    """POST studentMarksCredits.jsp and parse grades + credit summary."""
    print("[SP-DATA] fetch_marks_credits — cookie present:", bool(cookie))

    client = _build_client(cookie)
    try:
        _init_session(client)
        response = client.post(settings.sp_grades_url, data="")
        print(f"[SP-DATA] marks-credits status: {response.status_code}")

        if response.status_code != 200:
            print(f"[SP-DATA] marks-credits parse failure: HTTP {response.status_code}")
            return {"error": f"HTTP {response.status_code}"}

        parser = StudentPortalParser()
        result = parser.parse_grades(response.text)
        print(f"[SP-DATA] marks-credits parse success: cgpa={result.get('cgpa')}")
        return result
    except Exception as e:
        print(f"[SP-DATA] marks-credits exception: {e}")
        return {"error": str(e)}
    finally:
        client.close()


def fetch_profile(cookie: str) -> dict[str, Any]:
    """POST studentMarksCredits.jsp and extract student identity + photo."""
    print("[SP-DATA] fetch_profile — cookie present:", bool(cookie))

    client = _build_client(cookie)
    try:
        _init_session(client)
        response = client.post(settings.sp_grades_url, data="")
        print(f"[SP-DATA] profile status: {response.status_code}")

        if response.status_code != 200:
            return {"error": f"HTTP {response.status_code}"}

        html = response.text
        soup = BeautifulSoup(html, "lxml")
        profile: dict[str, Any] = {}

        m = re.search(r"\bRA\d{9,15}\b", html)
        if m:
            profile["reg_number"] = m.group(0)

        for sel in (
            "span[id*='tudent'][id*='ame']",
            "td[id*='tudent'][id*='ame']",
            "span[id*='Name']",
            "td[id*='Name']",
            "td[class*='student']",
        ):
            el = soup.select_one(sel)
            if el:
                text = el.get_text(strip=True)
                if text and len(text) > 2:
                    profile["name"] = text
                    break

        photo_src = None
        for img in soup.find_all("img"):
            src = img.get("src") or img.get("data-src") or ""
            low = src.lower()
            if not src or "captcha" in low or "logo" in low:
                continue
            if "photo" in low or "student" in low or "profile" in low or low.startswith("data:"):
                photo_src = src
                break

        if photo_src:
            try:
                url = photo_src if photo_src.startswith("http") else f"{settings.sp_base_url}{photo_src}"
                img_resp = client.get(url, headers={"User-Agent": "Mozilla/5.0"})
                if img_resp.status_code == 200 and img_resp.content:
                    profile["photo"] = (
                        "data:image/jpeg;base64," + base64.b64encode(img_resp.content).decode()
                    )
            except Exception as e:
                print(f"[SP-DATA] profile photo fetch failed: {e}")

        return {"profile": profile}
    except Exception as e:
        print(f"[SP-DATA] fetch_profile exception: {e}")
        return {"error": str(e)}
    finally:
        client.close()


def fetch_internal_marks(cookie: str) -> list[dict[str, str]]:
    """POST studentInternalMarkDetails.jsp and parse per-subject internal marks."""
    print("[SP-DATA] fetch_internal_marks — cookie present:", bool(cookie))

    client = _build_client(cookie)
    try:
        _init_session(client)
        response = client.post(settings.sp_internal_marks_url, data="")
        print(f"[SP-DATA] internal-marks status: {response.status_code}")

        if response.status_code != 200:
            print(f"[SP-DATA] internal-marks parse failure: HTTP {response.status_code}")
            return []

        parser = StudentPortalParser()
        marks = parser.parse_internal_marks(response.text)
        print(f"[SP-DATA] internal-marks parse success: {len(marks)} subjects")
        return marks
    except Exception as e:
        print(f"[SP-DATA] internal-marks exception: {e}")
        return []
    finally:
        client.close()


def fetch_internal_marks_detail(
    cookie: str, subject_id: str, status: str
) -> list[dict[str, str]]:
    """POST studentInternalMarkDetailsInner.jsp and parse component-wise breakdown."""
    print(f"[SP-DATA] fetch_internal_marks_detail — subject_id={subject_id}, status={status}")

    client = _build_client(cookie)
    try:
        _init_session(client)
        response = client.post(
            settings.sp_internal_marks_detail_url,
            data={
                "iden": subject_id,
                "hdnSubjectId": subject_id,
                "status": status,
            },
        )
        print(f"[SP-DATA] internal-marks-detail status: {response.status_code}")

        if response.status_code != 200:
            print(f"[SP-DATA] internal-marks-detail parse failure: HTTP {response.status_code}")
            return []

        parser = StudentPortalParser()
        components = parser.parse_internal_marks_detail(response.text)
        print(f"[SP-DATA] internal-marks-detail parse success: {len(components)} components")
        return components
    except Exception as e:
        print(f"[SP-DATA] internal-marks-detail exception: {e}")
        return []
    finally:
        client.close()
