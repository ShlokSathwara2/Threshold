from pydantic import BaseModel


class Attendance(BaseModel):
    courseCode: str
    courseTitle: str
    category: str
    facultyName: str
    slot: str
    hoursConducted: float
    hoursAbsent: float
    attendancePercentage: float


class AttendanceResponse(BaseModel):
    regNumber: str
    attendance: list[Attendance]
    status: int = 200
    error: str | None = None


class MarksDetail(BaseModel):
    scored: str
    total: str


class TestPerformance(BaseModel):
    test: str
    marks: MarksDetail


class Mark(BaseModel):
    courseName: str
    courseCode: str
    courseType: str
    overall: MarksDetail
    testPerformance: list[TestPerformance]


class MarksResponse(BaseModel):
    regNumber: str
    marks: list[Mark]
    status: int = 200
    error: str | None = None


class Course(BaseModel):
    code: str
    title: str
    credit: str
    category: str
    courseCategory: str
    type: str
    slotType: str
    faculty: str
    facultyName: str = ""
    facultyId: str = ""
    slot: str
    room: str
    academicYear: str


class CourseResponse(BaseModel):
    regNumber: str
    courses: list[Course]
    status: int = 200
    error: str | None = None


class User(BaseModel):
    regNumber: str | None = None
    name: str | None = None
    program: str | None = None
    batch: str | None = None
    mobile: str | None = None
    semester: int | None = None
    department: str | None = None
    section: str | None = None
    year: int | None = None


class TimetableSlot(BaseModel):
    day: str
    hour: int
    time: str = ""
    courseCode: str
    courseTitle: str
    slot: str
    faculty: str
    room: str


class TimetableResponse(BaseModel):
    regNumber: str
    batch: str
    schedule: list[TimetableSlot]
    status: int = 200
    error: str | None = None


class CalendarDay(BaseModel):
    date: str
    day: str
    event: str
    dayOrder: str
    isHoliday: bool = False


class CalendarMonth(BaseModel):
    month: str
    days: list[CalendarDay]


class CalendarResponse(BaseModel):
    status: int = 200
    today: CalendarDay | None = None
    tomorrow: CalendarDay | None = None
    index: int = 0
    calendar: list[CalendarMonth] = []
    error: bool = False
    message: str | None = None


class CaptchaData(BaseModel):
    image: str
    cdigest: str


class LoginResponse(BaseModel):
    success: bool
    status: int = 200
    message: str = ""
    cookies: str | None = None
    captcha: CaptchaData | None = None
    debug_screenshot_base64: str | None = None
    debug_errors: list[str] | None = None
