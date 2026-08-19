from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    academia_base_url: str = "https://academia.srmist.edu.in"
    portal_id: str = "10002227248"
    service_name: str = "ZohoCreator"
    attendance_page_name: str = "My_Attendance"
    course_page_name: str = "My_Time_Table_2023_24"
    calendar_page_name: str = "Academic_Planner_2025_26_EVEN"
    port: int = 8000
    cors_origins: str = (
        "http://localhost:3000,https://localhost,capacitor://localhost,"
        "https://threshold-jet.vercel.app"
    )

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

    def unified_timetable_url(self, batch: int, lower: bool = False) -> str:
        name = f"Unified_Time_Table_2025_Batch_{batch}" if not lower else f"Unified_Time_Table_2025_batch_{batch}"
        return f"{self.academia_base_url}/srm_university/academia-academic-services/page/{name}"

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
        return f"{self.sp_base_url}{self.sp_context_path}/students/report/studentAttendanceDetails.jsp"

    @property
    def sp_attendance_detail_url(self) -> str:
        return f"{self.sp_base_url}{self.sp_context_path}/students/report/studentAttendanceDetailsInner.jsp"

    @property
    def sp_grades_url(self) -> str:
        return f"{self.sp_base_url}{self.sp_context_path}/students/report/studentMarksCredits.jsp"

    @property
    def sp_internal_marks_url(self) -> str:
        return f"{self.sp_base_url}{self.sp_context_path}/students/report/studentInternalMarkDetails.jsp"

    @property
    def sp_internal_marks_detail_url(self) -> str:
        return f"{self.sp_base_url}{self.sp_context_path}/students/report/studentInternalMarkDetailsInner.jsp"

    @property
    def sp_academic_calendar_url(self) -> str:
        return f"{self.sp_base_url}{self.sp_context_path}/students/report/AcademicCalenderDetails.jsp"

    @property
    def sp_academic_calendar_inner_url(self) -> str:
        return f"{self.sp_base_url}{self.sp_context_path}/students/report/AcademicCalenderDetailsInner.jsp"

    @property
    def sp_personal_details_url(self) -> str:
        return f"{self.sp_base_url}{self.sp_context_path}/students/report/studentPersonalDetails.jsp"

    @property
    def sp_course_status_url(self) -> str:
        return f"{self.sp_base_url}{self.sp_context_path}/students/report/studentCourseStatus.jsp"

    @property
    def sp_exam_hall_ticket_url(self) -> str:
        return f"{self.sp_base_url}{self.sp_context_path}/students/report/StudentHallticket.jsp"

    @property
    def sp_exam_hall_ticket_inner_url(self) -> str:
        return f"{self.sp_base_url}{self.sp_context_path}/students/report/StudentHallticketinner.jsp"

    @property
    def sp_exam_timetable_url(self) -> str:
        return f"{self.sp_base_url}{self.sp_context_path}/students/transaction/StudentExamTimeTable.jsp"

    @property
    def sp_provisional_results_url(self) -> str:
        return f"{self.sp_base_url}{self.sp_context_path}/students/transaction/onlineResult.jsp"

    @property
    def sp_announcements_candidates(self) -> list[str]:
        # The portal ships a notification board under several names —
        # probe them in order and use the first one that yields rows.
        base = f"{self.sp_base_url}{self.sp_context_path}"
        return [
            f"{base}/students/report/studentNotificationBoard.jsp",
            f"{base}/students/report/StudentNotificationBoard.jsp",
            f"{base}/students/transaction/StudentNotificationBoard.jsp",
            f"{base}/students/report/studentNotifications.jsp",
        ]


settings = Settings()
