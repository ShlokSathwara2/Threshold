const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface Session {
  cookies: string;
  user: string;
  timestamp: number;
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

  if (session?.cookies) {
    headers['X-CSRF-Token'] = session.cookies;
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

export async function logout() {
  try {
    await apiFetch('/sp/logout', { method: 'DELETE' });
  } finally {
    clearSession();
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

export interface Course {
  code: string;
  title: string;
  credit: string;
  category: string;
  courseCategory: string;
  type: string;
  slotType: string;
  faculty: string;
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

export async function fetchSpInternalMarks(): Promise<InternalMark[]> {
  return apiFetch('/sp/internal-marks');
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

export interface SmartResponse {
  source: 'academia' | 'student_portal';
  attendance: AttendanceResponse;
}

export async function fetchSmartAttendance(): Promise<SmartResponse> {
  return apiFetch('/get-smart');
}
