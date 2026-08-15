from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse

from core.schemas.models import LoginResponse
from scraper.auth import AuthService
from scraper.workflow import AcademiaScraper
from scraper.student_portal.auth import StudentPortalAuth
from scraper.student_portal.workflow import StudentPortalScraper

router = APIRouter()
auth_service = AuthService()
sp_auth_service = StudentPortalAuth()


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
def logout(x_csrf_token: str = Header(alias="X-CSRF-Token")) -> dict:
    return auth_service.logout(x_csrf_token)


@router.get("/attendance")
def attendance(x_csrf_token: str = Header(alias="X-CSRF-Token")):
    try:
        scraper = AcademiaScraper(cookie=x_csrf_token)
        return scraper.attendance().model_dump()
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e), "status": 500}


@router.get("/marks")
def marks(x_csrf_token: str = Header(alias="X-CSRF-Token")):
    scraper = AcademiaScraper(cookie=x_csrf_token)
    return scraper.marks().model_dump()


@router.get("/courses")
def courses(x_csrf_token: str = Header(alias="X-CSRF-Token")):
    scraper = AcademiaScraper(cookie=x_csrf_token)
    return scraper.courses().model_dump()


@router.get("/user")
def user(x_csrf_token: str = Header(alias="X-CSRF-Token")):
    scraper = AcademiaScraper(cookie=x_csrf_token)
    return scraper.user().model_dump()


@router.get("/timetable")
def timetable(x_csrf_token: str = Header(alias="X-CSRF-Token")):
    scraper = AcademiaScraper(cookie=x_csrf_token)
    return scraper.timetable().model_dump()


@router.get("/calendar")
def calendar(x_csrf_token: str = Header(alias="X-CSRF-Token")):
    scraper = AcademiaScraper(cookie=x_csrf_token)
    return scraper.calendar().model_dump()


@router.get("/get")
def get_all(x_csrf_token: str = Header(alias="X-CSRF-Token")):
    scraper = AcademiaScraper(cookie=x_csrf_token)
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


# ── Fallback endpoint (tries Academia, falls back to Student Portal) ──

@router.get("/get-smart")
def get_smart(x_csrf_token: str = Header(alias="X-CSRF-Token")):
    """Try Academia first, fall back to Student Portal if it fails."""
    # Try Academia
    try:
        scraper = AcademiaScraper(cookie=x_csrf_token)
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
