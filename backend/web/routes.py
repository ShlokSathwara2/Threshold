import re

from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse

from core.config import settings
from core.schemas.models import LoginResponse
from scraper.auth import AuthService
from scraper.workflow import AcademiaScraper
from scraper.student_portal.auth import StudentPortalAuth
from scraper.student_portal import browser_login
from scraper.student_portal.workflow import StudentPortalScraper
from scraper.student_portal.data import (
    _build_client,
    _init_session,
    fetch_attendance,
    fetch_attendance_detail,
    fetch_marks_credits,
    fetch_internal_marks,
    fetch_internal_marks_detail,
    fetch_profile,
)

router = APIRouter()
auth_service = AuthService()
sp_auth_service = StudentPortalAuth()


def _academia_cookie(x_academia: str, x_csrf: str) -> str:
    """Prefer the dedicated academia token; fall back to the shared token."""
    return x_academia or x_csrf


# ── Academia endpoints ──────────────────────────────────────────────

@router.post("/login")
def login(body: dict):
    username = body.get("username", "")
    password = body.get("password", "")
    cdigest = body.get("cdigest")
    captcha = body.get("captcha")

    if not username or not password:
        return {"success": False, "status": 400, "message": "Username and password required"}

    try:
        result = auth_service.login(username, password, cdigest, captcha)
        return result.model_dump()
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "status": 500, "message": str(e)}


@router.delete("/logout")
def logout(
    x_academia_token: str = Header(default="", alias="X-Academia-Token"),
    x_csrf_token: str = Header(default="", alias="X-CSRF-Token"),
) -> dict:
    return auth_service.logout(_academia_cookie(x_academia_token, x_csrf_token))


@router.get("/attendance")
def attendance(
    x_academia_token: str = Header(default="", alias="X-Academia-Token"),
    x_csrf_token: str = Header(default="", alias="X-CSRF-Token"),
):
    try:
        scraper = AcademiaScraper(cookie=_academia_cookie(x_academia_token, x_csrf_token))
        return scraper.attendance().model_dump()
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e), "status": 500}


@router.get("/marks")
def marks(
    x_academia_token: str = Header(default="", alias="X-Academia-Token"),
    x_csrf_token: str = Header(default="", alias="X-CSRF-Token"),
):
    scraper = AcademiaScraper(cookie=_academia_cookie(x_academia_token, x_csrf_token))
    return scraper.marks().model_dump()


@router.get("/courses")
def courses(
    x_academia_token: str = Header(default="", alias="X-Academia-Token"),
    x_csrf_token: str = Header(default="", alias="X-CSRF-Token"),
):
    scraper = AcademiaScraper(cookie=_academia_cookie(x_academia_token, x_csrf_token))
    return scraper.courses().model_dump()


@router.get("/user")
def user(
    x_academia_token: str = Header(default="", alias="X-Academia-Token"),
    x_csrf_token: str = Header(default="", alias="X-CSRF-Token"),
):
    scraper = AcademiaScraper(cookie=_academia_cookie(x_academia_token, x_csrf_token))
    return scraper.user().model_dump()


@router.get("/timetable")
def timetable(
    x_academia_token: str = Header(default="", alias="X-Academia-Token"),
    x_csrf_token: str = Header(default="", alias="X-CSRF-Token"),
):
    scraper = AcademiaScraper(cookie=_academia_cookie(x_academia_token, x_csrf_token))
    return scraper.timetable().model_dump()


@router.get("/calendar")
def calendar(
    x_academia_token: str = Header(default="", alias="X-Academia-Token"),
    x_csrf_token: str = Header(default="", alias="X-CSRF-Token"),
):
    scraper = AcademiaScraper(cookie=_academia_cookie(x_academia_token, x_csrf_token))
    return scraper.calendar().model_dump()


@router.get("/get")
def get_all(
    x_academia_token: str = Header(default="", alias="X-Academia-Token"),
    x_csrf_token: str = Header(default="", alias="X-CSRF-Token"),
):
    scraper = AcademiaScraper(cookie=_academia_cookie(x_academia_token, x_csrf_token))
    return scraper.all_data()


# ── Student Portal endpoints ────────────────────────────────────────

_sp_manual_cookies: dict[str, str] = {}


@router.post("/sp/set-cookies")
def sp_set_cookies(body: dict):
    cookie_str = body.get("cookie", "")
    if not cookie_str:
        return {"success": False, "message": "cookie required"}
    _sp_manual_cookies["session"] = cookie_str
    return {"success": True, "message": "Cookies stored", "length": len(cookie_str)}


@router.post("/sp/login")
def sp_login(body: dict):
    username = body.get("username", "")
    password = body.get("password", "")

    if not username or not password:
        return {"success": False, "status": 400, "message": "Username and password required"}

    try:
        result = sp_auth_service.login(username, password)
        return result.model_dump()
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "status": 500, "message": str(e)}


@router.post("/sp/login-init")
async def sp_login_init(body: dict):
    username = body.get("username", "")
    if not username:
        return {"success": False, "status": 400, "message": "username required"}
    try:
        return await browser_login.start_login(username)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "status": 500, "message": str(e)}


@router.post("/sp/login-verify")
async def sp_login_verify(body: dict):
    session_id = body.get("session_id", "")
    username = body.get("username", "")
    password = body.get("password", "")
    captcha = body.get("captcha", "")
    if not all([session_id, username, password, captcha]):
        return {"success": False, "status": 400, "message": "All fields required (session_id, username, password, captcha)"}
    try:
        result = await browser_login.finish_login(session_id, username, password, captcha)
        return result.model_dump()
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "status": 500, "message": str(e)}


@router.delete("/sp/logout")
def sp_logout(x_csrf_token: str = Header(alias="X-CSRF-Token")) -> dict:
    return sp_auth_service.logout(x_csrf_token)


def _get_sp_cookie(x_csrf_token: str = Header(default="", alias="X-CSRF-Token")) -> str:
    return x_csrf_token or _sp_manual_cookies.get("session", "")


@router.get("/sp/attendance")
def sp_attendance(x_csrf_token: str = Header(default="", alias="X-CSRF-Token")):
    cookie = _get_sp_cookie(x_csrf_token)
    if not cookie:
        return {"error": "No cookie. POST /sp/set-cookies first.", "status": 401}
    try:
        scraper = StudentPortalScraper(cookie=cookie)
        return scraper.attendance().model_dump()
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e), "status": 500}


@router.get("/sp/marks")
def sp_marks(x_csrf_token: str = Header(default="", alias="X-CSRF-Token")):
    cookie = _get_sp_cookie(x_csrf_token)
    if not cookie:
        return {"error": "No cookie. POST /sp/set-cookies first.", "status": 401}
    try:
        scraper = StudentPortalScraper(cookie=cookie)
        return scraper.marks().model_dump()
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e), "status": 500}


@router.get("/sp/grades")
def sp_grades(x_csrf_token: str = Header(default="", alias="X-CSRF-Token")):
    cookie = _get_sp_cookie(x_csrf_token)
    if not cookie:
        return {"error": "No cookie. POST /sp/set-cookies first.", "status": 401}
    try:
        scraper = StudentPortalScraper(cookie=cookie)
        return scraper.grades()
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e), "status": 500}


@router.get("/sp/internal-marks")
def sp_internal_marks(x_csrf_token: str = Header(default="", alias="X-CSRF-Token")):
    cookie = _get_sp_cookie(x_csrf_token)
    if not cookie:
        return {"error": "No cookie. POST /sp/set-cookies first.", "status": 401}
    try:
        scraper = StudentPortalScraper(cookie=cookie)
        return {"internal_marks": scraper.internal_marks()}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e), "status": 500}


@router.get("/sp/profile")
def sp_profile(x_csrf_token: str = Header(default="", alias="X-CSRF-Token")):
    cookie = _get_sp_cookie(x_csrf_token)
    if not cookie:
        return {"error": "No cookie. POST /sp/set-cookies first.", "status": 401}
    try:
        return fetch_profile(cookie)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e), "status": 500}


@router.get("/sp/probe-pages")
def sp_probe_pages(x_csrf_token: str = Header(default="", alias="X-CSRF-Token")):
    """TEMP: discover portal page inventory from the main menu (Phase 6)."""
    cookie = _get_sp_cookie(x_csrf_token)
    if not cookie:
        return {"error": "No cookie. POST /sp/set-cookies first.", "status": 401}
    try:
        client = _build_client(cookie)
        _init_session(client)
        resp = client.get(
            f"{settings.sp_base_url}{settings.sp_context_path}/students/template/HRDSystem.jsp"
        )
        links = sorted(set(re.findall(r"['\"]([^'\"]*\.(?:jsp|do)[^'\"]*)['\"]", resp.text)))
        menu = sorted(set(re.findall(r">([^<>]{3,60})<", resp.text)))
        return {
            "status": resp.status_code,
            "length": len(resp.text),
            "links": links[:300],
            "link_count": len(links),
        }
    except Exception as e:
        return {"error": str(e), "status": 500}


@router.get("/sp/get")
def sp_get_all(x_csrf_token: str = Header(default="", alias="X-CSRF-Token")):
    cookie = _get_sp_cookie(x_csrf_token)
    if not cookie:
        return {"error": "No cookie. POST /sp/set-cookies first.", "status": 401}
    try:
        scraper = StudentPortalScraper(cookie=cookie)
        return scraper.all_data()
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e), "status": 500}


# ── Student Portal data-fetching (POST, via data.py) ──────────────

@router.post("/sp/attendance")
def sp_attendance_data(body: dict, x_csrf_token: str = Header(default="", alias="X-CSRF-Token")):
    cookie = x_csrf_token or body.get("cookie", "") or _sp_manual_cookies.get("session", "")
    if not cookie:
        return {"error": "No cookie. POST /sp/set-cookies first.", "status": 401}
    return fetch_attendance(cookie).model_dump()


@router.post("/sp/attendance-detail")
def sp_attendance_detail(body: dict, x_csrf_token: str = Header(default="", alias="X-CSRF-Token")):
    cookie = x_csrf_token or body.get("cookie", "") or _sp_manual_cookies.get("session", "")
    if not cookie:
        return {"error": "No cookie. POST /sp/set-cookies first.", "status": 401}
    subject_id = body.get("subject_id", "")
    month = body.get("month", 0)
    year = body.get("year", 0)
    if not subject_id:
        return {"error": "subject_id required", "status": 400}
    try:
        records = fetch_attendance_detail(cookie, subject_id, int(month), int(year))
        return {"records": records}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e), "status": 500}


@router.post("/sp/marks")
def sp_marks_data(body: dict, x_csrf_token: str = Header(default="", alias="X-CSRF-Token")):
    cookie = x_csrf_token or body.get("cookie", "") or _sp_manual_cookies.get("session", "")
    if not cookie:
        return {"error": "No cookie. POST /sp/set-cookies first.", "status": 401}
    return fetch_marks_credits(cookie)


@router.post("/sp/internal-marks")
def sp_internal_marks_data(body: dict, x_csrf_token: str = Header(default="", alias="X-CSRF-Token")):
    cookie = x_csrf_token or body.get("cookie", "") or _sp_manual_cookies.get("session", "")
    if not cookie:
        return {"error": "No cookie. POST /sp/set-cookies first.", "status": 401}
    return {"internal_marks": fetch_internal_marks(cookie)}


@router.post("/sp/internal-marks-detail")
def sp_internal_marks_detail(body: dict, x_csrf_token: str = Header(default="", alias="X-CSRF-Token")):
    cookie = x_csrf_token or body.get("cookie", "") or _sp_manual_cookies.get("session", "")
    if not cookie:
        return {"error": "No cookie. POST /sp/set-cookies first.", "status": 401}
    subject_id = body.get("subject_id", "")
    status = body.get("status", "")
    if not subject_id:
        return {"error": "subject_id required", "status": 400}
    try:
        components = fetch_internal_marks_detail(cookie, subject_id, status)
        return {"components": components}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e), "status": 500}


# ── Fallback endpoint (tries Academia, falls back to Student Portal) ──

@router.get("/get-smart")
def get_smart(
    x_academia_token: str = Header(default="", alias="X-Academia-Token"),
    x_csrf_token: str = Header(default="", alias="X-CSRF-Token"),
):
    """Try Academia first, fall back to Student Portal if it fails."""
    # Try Academia
    try:
        scraper = AcademiaScraper(cookie=_academia_cookie(x_academia_token, x_csrf_token))
        attendance = scraper.attendance()
        if attendance.status == 200 and attendance.attendance:
            return {
                "source": "academia",
                "attendance": attendance.model_dump(),
            }
    except Exception:
        pass

    # Fallback to Student Portal
    try:
        sp_scraper = StudentPortalScraper(cookie=x_csrf_token)
        attendance = sp_scraper.attendance()
        return {
            "source": "student_portal",
            "attendance": attendance.model_dump(),
        }
    except Exception as e:
        return {"error": f"Both sources failed: {e}", "status": 503}


# ── Health / utility ────────────────────────────────────────────────

@router.api_route("/", methods=["GET", "HEAD"])
def root():
    return {"status": "ok"}


@router.get("/hello")
def hello():
    return {"message": "Threshold backend is running"}
