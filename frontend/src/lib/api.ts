const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface Session {
  cookies: string;
  user: string;
  timestamp: number;
}

const ACADEMIA_KEY = 'threshold_academia_cookie';

export function getAcademiaCookies(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(ACADEMIA_KEY);
  } catch {
    return null;
  }
}

export function setAcademiaCookies(cookies: string) {
  try {
    localStorage.setItem(ACADEMIA_KEY, cookies);
  } catch {
    /* ignore */
  }
}

export function clearAcademiaCookies() {
  try {
    localStorage.removeItem(ACADEMIA_KEY);
  } catch {
    /* ignore */
  }
}

export function isAcademiaLoggedIn(): boolean {
  return !!getAcademiaCookies();
}

export function getSession(): Session | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('threshold_session');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem('threshold_session');
}

export function isLoggedIn(): boolean {
  return getSession() !== null;
}

export function isSpLoggedIn(): boolean {
  const session = getSession();
  return session !== null && !!session.cookies;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const session = getSession();
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  if (path.startsWith('/sp/')) {
    if (session?.cookies) {
      headers['X-CSRF-Token'] = session.cookies;
    }
  } else {
    const academia = getAcademiaCookies();
    if (academia) {
      headers['X-Academia-Token'] = academia;
    } else if (session?.cookies) {
      headers['X-CSRF-Token'] = session.cookies;
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || body.message || `Request failed (${res.status})`);
  }

  return res.json();
}

// ── Auth ───────────────────────────────────────────────────────────

export async function setSpCookies(cookie: string) {
  return apiFetch<{
    success: boolean;
    message?: string;
    length?: number;
  }>('/sp/set-cookies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cookie }),
  });
}

export async function spLoginInit(username: string) {
  return apiFetch<{
    success: boolean;
    session_id?: string;
    captcha_image_base64?: string;
    message?: string;
    status?: number;
  }>('/sp/login-init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
}

export async function spLoginVerify(sessionId: string, username: string, password: string, captcha: string) {
  return apiFetch<{
    success: boolean;
    cookies?: string;
    message?: string;
    status?: number;
  }>('/sp/login-verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, username, password, captcha }),
  });
}

export async function spLogin(username: string, password: string) {
  return apiFetch<{
    success: boolean;
    cookies?: string;
    message?: string;
    status?: number;
  }>('/sp/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}

export interface AcademiaLoginResponse {
  success: boolean;
  cookies?: string;
  captcha?: { image: string; cdigest: string };
  message?: string;
  status?: number;
}

export async function academiaLogin(
  username: string,
  password: string,
  cdigest?: string,
  captcha?: string
): Promise<AcademiaLoginResponse> {
  const body: Record<string, string> = { username, password };
  if (cdigest) body.cdigest = cdigest;
  if (captcha) body.captcha = captcha;
  return apiFetch<AcademiaLoginResponse>('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function logout() {
  try {
    await apiFetch('/sp/logout', { method: 'DELETE' });
  } finally {
    clearSession();
    clearAcademiaCookies();
  }
}

// ── Data ───────────────────────────────────────────────────────────

export interface Attendance {
  courseCode: string;
  courseTitle: string;
  category: string;
  facultyName: string;
  slot: string;
  hoursConducted: number;
  hoursAbsent: number;
  attendancePercentage: number;
}

export interface AttendanceResponse {
  regNumber: string;
  attendance: Attendance[];
  status: number;
  error?: string;
}

export async function fetchAttendance(): Promise<AttendanceResponse> {
  return apiFetch('/sp/attendance');
}

export const fetchSpAttendance = fetchAttendance;

export interface MarksDetail {
  scored: string;
  total: string;
}

export interface TestPerformance {
  test: string;
  marks: MarksDetail;
}

export interface Mark {
  courseName: string;
  courseCode: string;
  courseType: string;
  overall: MarksDetail;
  testPerformance: TestPerformance[];
}

export interface MarksResponse {
  regNumber: string;
  marks: Mark[];
  status: number;
  error?: string;
}

export async function fetchMarks(): Promise<MarksResponse> {
  return apiFetch('/sp/marks');
}

export interface GradeCourse {
  code: string;
  description: string;
  credit: string;
  grade: string;
}

export interface SemesterResult {
  semester: number;
  sgpa: number | null;
  grades: GradeCourse[];
}

export interface Course {
  code: string;
  title: string;
  credit: string;
  category: string;
  courseCategory: string;
  type: string;
  slotType: string;
  faculty: string;
  facultyName?: string;
  facultyId?: string;
  slot: string;
  room: string;
  academicYear: string;
}

export interface CourseResponse {
  regNumber: string;
  courses: Course[];
  status: number;
  error?: string;
}

export async function fetchCourses(): Promise<CourseResponse> {
  return apiFetch('/courses');
}

// ── Student Portal: Grades & Internal Marks ──────────────────────────

export interface SemesterGrade {
  code: string;
  description: string;
  credit: string;
  grade: string;
}

export interface SemesterGrades {
  semester: number;
  sgpa: number | null;
  grades: SemesterGrade[];
}

export interface GradesResponse {
  semesters: SemesterGrades[];
  cgpa: number | null;
  credits_registered: number | null;
  credits_earned: number | null;
  credits_required: number | null;
}

export async function fetchSpGrades(): Promise<GradesResponse> {
  return apiFetch('/sp/grades');
}

export interface InternalMark {
  code: string;
  description: string;
  scored: string;
  maxMark: string;
}

export interface InternalMarksResponse {
  internal_marks: InternalMark[];
  error?: string;
}

export async function fetchSpInternalMarks(): Promise<InternalMarksResponse> {
  return apiFetch('/sp/internal-marks');
}

export interface SpProfile {
  name?: string;
  reg_number?: string;
  photo?: string;
  semester?: number;
  student_id?: string;
  email?: string;
  institution?: string;
  program?: string;
  batch?: string;
  section?: string;
  faculty_advisor?: string;
  academic_advisor?: string;
}

export interface SpProfileResponse {
  profile?: SpProfile;
  error?: string;
}

export async function fetchSpProfile(): Promise<SpProfileResponse> {
  return apiFetch('/sp/profile');
}

export interface User {
  regNumber?: string;
  name?: string;
  program?: string;
  batch?: string;
  mobile?: string;
  semester?: number;
  department?: string;
  section?: string;
  year?: number;
}

export async function fetchUser(): Promise<User> {
  return apiFetch('/user');
}

export interface TimetableSlot {
  day: string;
  hour: number;
  time: string;
  courseCode: string;
  courseTitle: string;
  slot: string;
  faculty: string;
  room: string;
}

export interface TimetableResponse {
  regNumber: string;
  batch: string;
  schedule: TimetableSlot[];
  status: number;
  error?: string;
}

export async function fetchTimetable(): Promise<TimetableResponse> {
  return apiFetch('/timetable');
}

export interface CalendarDay {
  date: string;
  day: string;
  event: string;
  dayOrder: string;
}

export interface CalendarMonth {
  month: string;
  year?: number;
  days: CalendarDay[];
}

export interface CalendarResponse {
  error?: boolean;
  message?: string;
  today?: CalendarDay | null;
  tomorrow?: CalendarDay | null;
  index?: number;
  calendar: CalendarMonth[];
  status: number;
}

export async function fetchCalendar(): Promise<CalendarResponse> {
  return apiFetch('/sp/calendar');
}

export async function checkSpSession(): Promise<{ alive: boolean }> {
  try {
    return await apiFetch('/sp/check');
  } catch {
    return { alive: false };
  }
}

export interface SmartResponse {
  source: 'academia' | 'student_portal';
  attendance: AttendanceResponse;
}

export async function fetchSmartAttendance(): Promise<SmartResponse> {
  return apiFetch('/get-smart');
}
