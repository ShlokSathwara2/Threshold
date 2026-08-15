from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    academia_base_url: str = "https://academia.srmist.edu.in"
    portal_id: str = "10002227248"
    service_name: str = "ZohoCreator"
    attendance_page_name: str = "My_Attendance"
    course_page_name: str = "My_Time_Table_2023_24"
    calendar_page_name: str = "Academic_Planner_2025_26_EVEN"
    port: int = 8000
    cors_origins: str = "http://localhost:3000"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def signin_url(self) -> str:
        return f"{self.academia_base_url}/accounts/signin.ac"

    @property
    def logout_url(self) -> str:
        return (
            f"{self.academia_base_url}/accounts/p/{self.portal_id}/logout"
            f"?servicename={self.service_name}&serviceurl={self.academia_base_url}"
        )

    @property
    def active_sessions_url(self) -> str:
        return f"{self.academia_base_url}/accounts/p/{self.portal_id}/webclient/v1/account/self/user/self/activesessions"

    @property
    def captcha_url(self) -> str:
        return f"{self.academia_base_url}/accounts/p/40-{self.portal_id}/webclient/v1/captcha/{{cdigest}}?darkmode=false"

    @property
    def attendance_url(self) -> str:
        return f"{self.academia_base_url}/srm_university/academia-academic-services/page/{self.attendance_page_name}"

    @property
    def course_url(self) -> str:
        return f"{self.academia_base_url}/srm_university/academia-academic-services/page/{self.course_page_name}"

    @property
    def calendar_url(self) -> str:
        return f"{self.academia_base_url}/srm_university/academia-academic-services/page/{self.calendar_page_name}"

    # Student Portal settings
    sp_base_url: str = "https://sp.srmist.edu.in"
    sp_context_path: str = "/srmiststudentportal"

    @property
    def sp_login_page_url(self) -> str:
        return f"{self.sp_base_url}{self.sp_context_path}/students/loginManager/youLogin.jsp"

    @property
    def sp_login_url(self) -> str:
        return f"{self.sp_base_url}{self.sp_context_path}/LoginServlet"

    @property
    def sp_attendance_url(self) -> str:
        return f"{self.sp_base_url}{self.sp_context_path}/students/template/studentAttendanceDetails.jsp"

    @property
    def sp_attendance_detail_url(self) -> str:
        return f"{self.sp_base_url}{self.sp_context_path}/students/report/studentAttendanceDetailsInner.jsp"

    @property
    def sp_grades_url(self) -> str:
        return f"{self.sp_base_url}{self.sp_context_path}/students/template/studentGradeDetails.jsp"

    @property
    def sp_internal_marks_url(self) -> str:
        return f"{self.sp_base_url}{self.sp_context_path}/students/template/studentInternalMarkDetails.jsp"

    @property
    def sp_internal_marks_detail_url(self) -> str:
        return f"{self.sp_base_url}{self.sp_context_path}/students/report/studentInternalMarkDetailsInner.jsp"


settings = Settings()
