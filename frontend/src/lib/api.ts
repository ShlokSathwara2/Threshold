const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

import { userHash, isPlaceholderUser, migrateLegacyIdentity } from './user-scope';

export interface Session {
  cookies: string;
  user: string;
  timestamp: number;
}

// Academia session is kept in memory ONLY — never persisted to localStorage.
// The timetable belongs to whoever logs in, so each user on a shared device
// must enter their own academia credentials (asked on every app launch).
let academiaCookie: string | null = null;
let academiaUsername: string | null = null;

export function getAcademiaCookies(): string | null {
  return academiaCookie;
}

export function getAcademiaUsername(): string | null {
  return academiaUsername;
}

export function setAcademiaCookies(cookies: string, username?: string) {
  academiaCookie = cookies;
  if (username) academiaUsername = username;
}

export function clearAcademiaCookies() {
  academiaCookie = null;
  academiaUsername = null;
}

export function isAcademiaLoggedIn(): boolean {
  return !!academiaCookie;
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

// Resolve the student's stable identity (SP registration number) from the
// portal, using the just-captured cookie. Every per-login storage key hashes
// this — so a friend signing in on the same phone gets their own exams,
// optional-hour marks, habits, etc.
export async function resolveSessionUser(cookies: string): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/sp/profile`, {
      headers: { 'X-CSRF-Token': cookies },
    });
    if (!res.ok) return '';
    const body = await res.json() as { profile?: { reg_number?: unknown } };
    const reg = body?.profile?.reg_number;
    if (typeof reg !== 'string') return '';
    const id = reg.trim().toUpperCase();
    // SRM registration numbers look like RA2411003010247 — anything else is a
    // parse artifact and must not become a per-login identity.
    return /^RA\d{4,}$/i.test(id) ? id : '';
  } catch {
    return '';
  }
}

// Persist the session keyed by the REAL identity when it can be resolved;
// falls back to the caller-provided username, then the legacy shared
// placeholder (upgraded automatically once the profile loads).
export async function saveSession(cookies: string, fallbackUser = ''): Promise<string> {
  const identity = await resolveSessionUser(cookies);
  const user = identity || fallbackUser || 'student';
  localStorage.setItem('threshold_session', JSON.stringify({ cookies, user, timestamp: Date.now() }));
  migrateLegacyIdentity();
  return user;
}

// Upgrade a placeholder-keyed session once the profile reveals the reg number
// (covers offline logins where identity resolution failed at login time).
export function upgradeSessionUser(regNumber: string): boolean {
  const session = getSession();
  if (!session || !isPlaceholderUser(session.user)) return false;
  session.user = regNumber;
  localStorage.setItem('threshold_session', JSON.stringify(session));
  migrateLegacyIdentity();
  return true;
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

  // Delta sync: when the backend hash matches, the response is
  // {"delta":"unchanged"} and we short-circuit to the cached copy —
  // no re-scrape, no wasted battery. Only for the heavy SP GETs.
  const ns = (!options.method || options.method === 'GET') ? DELTA_NS[path] : undefined;
  if (ns && typeof window !== 'undefined') {
    const hash = getLs(deltaKeys(ns).hash);
    if (hash) headers['X-Delta-Hash'] = hash;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || body.message || `Request failed (${res.status})`);
  }

  const body = await res.json();
  if (ns && body && typeof body === 'object' && 'delta' in body) {
    if (body.delta === 'unchanged') {
      const raw = getLs(deltaKeys(ns).raw);
      if (raw) return JSON.parse(raw) as T;
    } else {
      setLs(deltaKeys(ns).hash, String(body.hash ?? ''));
      setLs(deltaKeys(ns).raw, JSON.stringify(body));
      recordSync(path);
    }
  }
  return body as T;
}

// ── Delta sync helpers ─────────────────────────────────────────────

const DELTA_NS: Record<string, string> = {
  '/sp/attendance': 'attendance',
  '/sp/marks': 'marks',
  '/sp/internal-marks': 'internal-marks',
  '/sp/calendar': 'calendar',
  '/sp/profile': 'profile',
};

function deltaKeys(ns: string) {
  // Scoped per login: one student's cached payloads can never be served to
  // another login on the same device.
  const h = userHash();
  return { hash: `threshold_delta_hash__${h}__${ns}`, raw: `threshold_delta_raw__${h}__${ns}` };
}

function getLs(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setLs(key: string, val: string) {
  try {
    localStorage.setItem(key, val);
  } catch {
    /* storage full/unavailable — ignore */
  }
}

const SYNC_LOG_KEY = () => `threshold_sync_log__${userHash()}`;

export function recordSync(path: string) {
  try {
    const raw = localStorage.getItem(SYNC_LOG_KEY());
    const log = raw ? JSON.parse(raw) : {};
    log[path] = Date.now();
    localStorage.setItem(SYNC_LOG_KEY(), JSON.stringify(log));
  } catch {
    /* ignore */
  }
}

export function lastSyncTime(): number | null {
  try {
    const raw = localStorage.getItem(SYNC_LOG_KEY());
    if (!raw) return null;
    const log = JSON.parse(raw) as Record<string, number>;
    const ts = Object.values(log);
    return ts.length ? Math.max(...ts) : null;
  } catch {
    return null;
  }
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
  isHoliday?: boolean;
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

// ── Student Portal: Personal Details / Course Status / Exams ────────────

export interface PersonalDetailsField {
  label: string;
  value: string;
}

export interface PersonalDetailsSection {
  title: string;
  fields: PersonalDetailsField[];
}

export interface PersonalDetailsResponse {
  sections?: PersonalDetailsSection[];
  error?: string;
}

export async function fetchSpPersonalDetails(): Promise<PersonalDetailsResponse> {
  return apiFetch('/sp/personal-details');
}

export interface CourseStatusRow {
  category: string;
  code: string;
  description: string;
  credit: string;
  grade: string;
  completed: string;
  attempts: string;
}

export interface CategorySummaryRow {
  category: string;
  required: string;
  acquired: string;
  subjects_required?: string;
  subjects_completed?: string;
}

export interface SemesterCategoryRow {
  semester: number;
  category: string;
  required: string;
  acquired: string;
  subjects_required?: string;
  subjects_completed?: string;
}

export interface CourseStatusResponse {
  courses?: CourseStatusRow[];
  category_summary?: CategorySummaryRow[];
  semester_wise?: SemesterCategoryRow[];
  error?: string;
}

export async function fetchSpCourseStatus(): Promise<CourseStatusResponse> {
  return apiFetch('/sp/course-status');
}

export interface HallTicketSubject {
  code: string;
  description: string;
  date: string;
  session: string;
  hall: string;
  seat: string;
}

export interface HallTicketResponse {
  available: boolean;
  student: Record<string, string>;
  subjects: HallTicketSubject[];
  error?: string;
}

export async function fetchSpHallTicket(): Promise<HallTicketResponse> {
  return apiFetch('/sp/exam/hall-ticket');
}

export interface ExamTimetableRow {
  sem_year_trim?: string;
  subject_code: string;
  subject_description?: string;
  date_session?: string;
  hall_no?: string;
  seat_no?: string;
  [key: string]: string | undefined;
}

export interface ExamTimetableResponse {
  available: boolean;
  rows: ExamTimetableRow[];
  error?: string;
}

export async function fetchSpExamTimetable(): Promise<ExamTimetableResponse> {
  return apiFetch('/sp/exam/timetable');
}

export interface ProvisionalResultsResponse {
  available: boolean;
  rows: Record<string, string>[];
  error?: string;
}

export async function fetchSpProvisionalResults(): Promise<ProvisionalResultsResponse> {
  return apiFetch('/sp/exam/provisional-results');
}

export interface SmartResponse {
  source: 'academia' | 'student_portal';
  attendance: AttendanceResponse;
}

export async function fetchSmartAttendance(): Promise<SmartResponse> {
  return apiFetch('/get-smart');
}

// ── Exam store (login-specific, synced to backend) ─────────────────

export interface CloudExam {
  id: string;
  subjectCode: string;
  subjectTitle: string;
  dates: string[];
  description?: string;
}

export async function fetchSpExams(user: string): Promise<CloudExam[]> {
  const res = await apiFetch<{ exams: CloudExam[] }>('/sp/exams', {
    headers: { 'X-User': user },
  });
  return Array.isArray(res.exams) ? res.exams : [];
}

export async function saveSpExams(user: string, exams: CloudExam[]): Promise<void> {
  await apiFetch('/sp/exams', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-User': user },
    body: JSON.stringify({ exams }),
  });
}
