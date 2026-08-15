from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse

from core.schemas.models import LoginResponse
from scraper.auth import AuthService
from scraper.workflow import AcademiaScraper

router = APIRouter()
auth_service = AuthService()


@router.post("/login")
def login(body: dict) -> LoginResponse:
    username = body.get("username", "")
    password = body.get("password", "")
    cdigest = body.get("cdigest")
    captcha = body.get("captcha")

    if not username or not password:
        return LoginResponse(False, status=400, message="Username and password required")

    return auth_service.login(username, password, cdigest, captcha)


@router.delete("/logout")
def logout(x_csrf_token: str = Header(alias="X-CSRF-Token")) -> dict:
    return auth_service.logout(x_csrf_token)


@router.get("/attendance")
def attendance(x_csrf_token: str = Header(alias="X-CSRF-Token")):
    scraper = AcademiaScraper(cookie=x_csrf_token)
    return scraper.attendance().model_dump()


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


@router.get("/")
def root():
    return {"status": "ok"}


@router.get("/hello")
def hello():
    return {"message": "Threshold backend is running"}
