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


def _extract_dashboard_fields(dash_soup: BeautifulSoup | None) -> dict[str, str]:
    """Extract label → value pairs from the SP dashboard table.

    The dashboard renders rows like "Student Name | SHLOK PARESH SATHWARA".
    """
    fields: dict[str, str] = {}
    if dash_soup is None:
        return fields

    label_map = {
        "student name": "name",
        "name": "name",
        "student id": "student_id",
        "student id no": "student_id",
        "id": "student_id",
        "register no": "reg_number",
        "register no.": "reg_number",
        "register number": "reg_number",
        "reg no": "reg_number",
        "reg no.": "reg_number",
        "reg no.": "reg_number",
        "email id": "email",
        "email": "email",
        "e-mail": "email",
        "institution": "institution",
        "program": "program",
        "programme": "program",
        "program name": "program",
        "semester": "semester",
        "sem": "semester",
        "batch": "batch",
        "section": "section",
        "faculty advisor": "faculty_advisor",
        "faculty adviser": "faculty_advisor",
        "academic advisor": "academic_advisor",
        "academic adviser": "academic_advisor",
    }

    for row in dash_soup.find_all("tr"):
        cells = row.find_all(["td", "th"])
        if len(cells) < 2:
            continue
        label_text = cells[0].get_text(" ", strip=True).lower()
        # Normalize repeated whitespace + trailing colons
        label_text = " ".join(label_text.split()).rstrip(":")
        if label_text not in label_map:
            continue
        value = cells[1].get_text(" ", strip=True)
        value = " ".join(value.split())
        if value and value not in ("-", "--", "N/A", "NA", "None", "null"):
            fields[label_map[label_text]] = value

    return fields


def fetch_profile(cookie: str) -> dict[str, Any]:
    """Fetch the SP dashboard (HRDSystem.jsp) for photo + name + reg, then grades for semester."""
    print("[SP-DATA] fetch_profile — cookie present:", bool(cookie))

    client = _build_client(cookie)
    try:
        _init_session(client)

        # 1. Fetch the main dashboard page — has photo, name, reg number
        dash_url = f"{settings.sp_base_url}{settings.sp_context_path}/students/template/HRDSystem.jsp"
        dash_resp = client.post(dash_url, data="")
        print(f"[SP-DATA] dashboard status: {dash_resp.status_code}")

        profile: dict[str, Any] = {}
        dash_html = dash_resp.text if dash_resp.status_code == 200 else ""
        dash_soup = BeautifulSoup(dash_html, "lxml") if dash_html else None

        # 2. Fetch grades page for semester + reg fallback
        grades_resp = client.post(settings.sp_grades_url, data="")
        grades_html = grades_resp.text if grades_resp.status_code == 200 else ""
        grades_soup = BeautifulSoup(grades_html, "lxml") if grades_html else None
        print(f"[SP-DATA] grades status: {grades_resp.status_code}")

        # ── Label/value rows from the dashboard table ────────────
        fields = _extract_dashboard_fields(dash_soup)
        for key, value in fields.items():
            if key not in profile:
                profile[key] = value

        # ── Reg number (fallback: regex anywhere in HTML) ────────
        if "reg_number" not in profile:
            for html_src in (dash_html, grades_html):
                m = re.search(r"\bRA\d{9,15}\b", html_src)
                if m:
                    profile["reg_number"] = m.group(0)
                    break

        # ── Semester ────────────────────────────────────────────
        semester = None
        sem_value = fields.get("semester")
        if sem_value:
            try:
                semester = int(re.search(r"\d+", sem_value).group(0))
            except (ValueError, AttributeError):
                semester = None
        if semester is None:
            for html_src in (grades_html, dash_html):
                m = re.search(r"(?i)semester\s*:?\s*(\d{1,2})", html_src)
                if m:
                    try:
                        semester = int(m.group(1))
                    except ValueError:
                        semester = None
                    break
        if semester is None and grades_html:
            grades = StudentPortalParser().parse_grades(grades_html)
            semesters = grades.get("semesters") or []
            if semesters:
                semester = semesters[-1]["semester"] + 1
        if semester is not None:
            profile["semester"] = semester

        # ── Name ────────────────────────────────────────────────
        # Try dashboard first (it shows the student's name prominently)
        if dash_soup:
            for sel in (
                "span[id*='tudent'][id*='ame']",
                "td[id*='tudent'][id*='ame']",
                "span[id*='Name']",
                "td[id*='Name']",
                "td[class*='student']",
                "span[id*='name']",
                "div[id*='name']",
                "div[id*='Name']",
                # Common SP dashboard selectors
                "span[style*='font-weight']",
                "b[id*='name']",
                "b[id*='Name']",
                "strong[id*='name']",
                "label[id*='name']",
                "label[id*='Name']",
            ):
                el = dash_soup.select_one(sel)
                if el:
                    text = el.get_text(strip=True)
                    if text and len(text) > 2 and not any(
                        skip in text.lower() for skip in ("welcome", "menu", "dashboard", "logout", "password", "home")
                    ):
                        profile["name"] = text
                        break

        # Fallback: regex for name patterns on dashboard
        # IMPORTANT: strip script/style tags first so JS method names
        # like "toLowerCase" never match the name patterns.
        if "name" not in profile and dash_html:
            cleaned = re.sub(r"<script[^>]*>.*?</script>", " ", dash_html, flags=re.S | re.I)
            cleaned = re.sub(r"<style[^>]*>.*?</style>", " ", cleaned, flags=re.S | re.I)
            # Only scan body-level text nodes, not attributes
            for pattern in (
                r"(?i)(?:student\s*name|student\s*id)\s*[:.\-]\s*([A-Z][A-Za-z]{2,30})",
                r"(?i)Welcome\s+(?:to|,)\s*([A-Z][A-Za-z]{2,30})",
            ):
                m = re.search(pattern, cleaned)
                if m:
                    name = m.group(1).strip()
                    if len(name) > 3 and not any(
                        skip in name.lower() for skip in ("welcome", "srm", "student", "portal", "javascript", "function")
                    ):
                        profile["name"] = name
                        break

            if "name" not in profile:
                # Safer: use BeautifulSoup text without script/style, then find
                # the first "NAME" label and take the value after it
                for script in dash_soup(["script", "style"]):
                    script.decompose()
                labels = dash_soup.find_all(string=re.compile(r"(?i)(name|student)"))
                for label in labels:
                    parent = label.parent
                    if parent and parent.name in ("td", "span", "div", "b", "strong", "label", "p"):
                        row_text = parent.parent.get_text(" ", strip=True) if parent.parent else ""
                        m = re.search(r"(?i)name\s*[:.\-]\s*([A-Z][A-Za-z]{2,25}(?:\s+[A-Z][A-Za-z]{2,25}){0,3})", row_text)
                        if m and not any(
                            skip in m.group(1).lower()
                            for skip in ("welcome", "srm", "student", "portal", "javascript", "function", "login", "logout")
                        ):
                            profile["name"] = m.group(1).strip()
                            break

        # Also try the grades page for name
        if "name" not in profile and grades_soup:
            for sel in (
                "span[id*='tudent'][id*='ame']",
                "td[id*='tudent'][id*='ame']",
                "span[id*='Name']",
                "td[id*='Name']",
            ):
                el = grades_soup.select_one(sel)
                if el:
                    text = el.get_text(strip=True)
                    if text and len(text) > 2:
                        profile["name"] = text
                        break

        # ── Photo ───────────────────────────────────────────────
        # Dashboard is where the student photo lives
        for soup_src in (dash_soup, grades_soup):
            if not soup_src:
                continue
            for img in soup_src.find_all("img"):
                src = img.get("src") or img.get("data-src") or ""
                if not src:
                    continue
                low = src.lower()
                if "captcha" in low or "logo" in low or "icon" in low:
                    continue
                # On the dashboard, student photos are usually in a specific location
                if (
                    "photo" in low
                    or "student" in low
                    or "profile" in low
                    or "image" in low
                    or "pic" in low
                    or "avatar" in low
                    or "display" in low
                    or "/data:image" in src
                    or "getstudentphoto" in low
                    or "showimage" in low
                    or "photograph" in low
                    or low.endswith((".jpg", ".jpeg", ".png", ".gif"))
                ):
                    # Skip tiny icons/badges
                    width = img.get("width", "")
                    height = img.get("height", "")
                    try:
                        w = int(str(width).replace("px", ""))
                        h = int(str(height).replace("px", ""))
                        if w < 20 or h < 20:
                            continue
                    except (ValueError, TypeError):
                        pass
                    photo_src = src
                    break
            if profile.get("photo"):
                break
        else:
            photo_src = None

        if photo_src and "photo" not in profile:
            try:
                url = photo_src if photo_src.startswith("http") else f"{settings.sp_base_url}{photo_src}"
                img_resp = client.get(url, headers={"User-Agent": "Mozilla/5.0"})
                if img_resp.status_code == 200 and img_resp.content and len(img_resp.content) > 200:
                    profile["photo"] = (
                        "data:image/jpeg;base64," + base64.b64encode(img_resp.content).decode()
                    )
                    print(f"[SP-DATA] profile photo fetched: {len(img_resp.content)} bytes")
            except Exception as e:
                print(f"[SP-DATA] profile photo fetch failed: {e}")

        # ── Reg from img src ────────────────────────────────────
        # Sometimes the photo URL itself contains the reg number
        if "reg_number" not in profile and photo_src:
            m = re.search(r"(RA\d{9,15})", photo_src)
            if m:
                profile["reg_number"] = m.group(1)

        print(f"[SP-DATA] profile result: {list(profile.keys())}")
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
