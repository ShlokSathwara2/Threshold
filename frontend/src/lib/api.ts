const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://threshold-1-ly01.onrender.com';

import { userHash, isPlaceholderUser, migrateLegacyIdentity } from './user-scope';

export interface Session {
  cookies: string;
  user: string;
  timestamp: number;
  source?: 'sp' | 'campus_web';
}

// Academia session is kept in sessionStorage — persists across page refreshes
// within the same tab but clears when the tab closes. Each user on a shared
// device must enter their own academia credentials per browser session.
const ACADEMIA_STORAGE_KEY = 'threshold_academia_session';
let academiaCookie: string | null = null;
let academiaUsername: string | null = null;

// Restore from sessionStorage on module load (survives page refresh)
if (typeof window !== 'undefined') {
  try {
    const stored = sessionStorage.getItem(ACADEMIA_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      academiaCookie = parsed.cookie || null;
      academiaUsername = parsed.username || null;
    }
  } catch { /* corrupted — ignore */ }
}

export function getAcademiaCookies(): string | null {
  return academiaCookie;
}

export function getAcademiaUsername(): string | null {
  return academiaUsername;
}

export function setAcademiaCookies(cookies: string, username?: string) {
  academiaCookie = cookies;
  if (username) academiaUsername = username;
  // Persist to sessionStorage so enrichment survives page refresh
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(ACADEMIA_STORAGE_KEY, JSON.stringify({ cookie: cookies, username: academiaUsername }));
    } catch { /* non-fatal */ }
  }
}

export function clearAcademiaCookies() {
  academiaCookie = null;
  academiaUsername = null;
  if (typeof window !== 'undefined') {
    try { sessionStorage.removeItem(ACADEMIA_STORAGE_KEY); } catch { /* non-fatal */ }
  }
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

export function isCampusWebSession(): boolean {
  return getSession()?.source === 'campus_web';
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
      if (raw) {
        try {
          return JSON.parse(raw) as T;
        } catch {
          // Corrupt cache — fall through to re-fetch
        }
      }
      // Raw cache missing or corrupt — re-fetch without delta hash
      delete headers['X-Delta-Hash'];
      const retry = await fetch(`${API_BASE}${path}`, { ...options, headers });
      if (!retry.ok) {
        const retryBody = await retry.json().catch(() => ({}));
        throw new Error(retryBody.error || retryBody.message || `Request failed (${retry.status})`);
      }
      const retryBody = await retry.json();
      if (ns && retryBody && typeof retryBody === 'object' && retryBody.delta !== 'unchanged') {
        setLs(deltaKeys(ns).hash, String(retryBody.hash ?? ''));
        setLs(deltaKeys(ns).raw, JSON.stringify(retryBody));
        recordSync(path);
      }
      return retryBody as T;
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

export async function fetchAcademiaAttendance(): Promise<AttendanceResponse> {
  return apiFetch('/attendance');
}

export const fetchSpAttendance = fetchAttendance;

export interface MarksDetail {
  scored: string;
  total: string;
}

export interface TestPerformance {
  test: string;
  marks: MarksDetail;
  external?: string;
  weightage?: string;
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

// Academia's per-test internal-mark breakdown (FT-1, FT-2, quizzes — any
// names/count the portal reports). Uses the in-memory academia session.
export async function fetchAcademiaMarks(): Promise<MarksResponse> {
  return apiFetch('/marks');
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
  if (isAcademiaLoggedIn()) {
    return apiFetch('/timetable');
  }
  return { regNumber: '', batch: '', schedule: [], status: 200, error: 'Login with your Academia credentials to load the timetable.' };
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
  if (isCampusWebSession()) {
    try {
      const planner: any = await fetchCampusWebPlanner();
      return adaptCampusWebPlanner(planner);
    } catch {
      return { calendar: [], status: 200 };
    }
  }
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

export interface AnnouncementRow {
  date: string;
  title: string;
  body: string;
}

export interface AnnouncementsResponse {
  rows: AnnouncementRow[];
  source?: string | null;
  error?: string;
}

export async function fetchSpAnnouncements(): Promise<AnnouncementsResponse> {
  return apiFetch('/sp/announcements');
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

// ── STEP class store ─────────────────────────────────────────────

export interface CloudScheduleClass {
  id: string;
  name: string;
  schedule: { day: string; startTime: string; endTime: string }[];
}

export async function fetchSpStepClasses(user: string): Promise<CloudScheduleClass[]> {
  const res = await apiFetch<{ classes: CloudScheduleClass[] }>('/sp/step-classes', {
    headers: { 'X-User': user },
  });
  return Array.isArray(res.classes) ? res.classes : [];
}

export async function saveSpStepClasses(user: string, classes: CloudScheduleClass[]): Promise<void> {
  await apiFetch('/sp/step-classes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-User': user },
    body: JSON.stringify({ classes }),
  });
}

// ── Aptitude class store ─────────────────────────────────────────

export async function fetchSpAptitudeClasses(user: string): Promise<CloudScheduleClass[]> {
  const res = await apiFetch<{ classes: CloudScheduleClass[] }>('/sp/aptitude-classes', {
    headers: { 'X-User': user },
  });
  return Array.isArray(res.classes) ? res.classes : [];
}

export async function saveSpAptitudeClasses(user: string, classes: CloudScheduleClass[]): Promise<void> {
  await apiFetch('/sp/aptitude-classes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-User': user },
    body: JSON.stringify({ classes }),
  });
}

// ── Campus Web API (Web login) ────────────────────────────────────
// When running in a browser (not the native APK), we use Campus Web's
// backend to bypass the WAF and avoid CAPTCHA entirely.
// Login: POST https://campusapi.fly.dev/api/auth/login/
// Token is returned in the `cookies` field of the response.

const CAMPUS_WEB_API = 'https://campusapi.fly.dev';

export interface CampusWebLoginResponse {
  cookies?: string;
  status?: string;
  Status?: string;
  message?: string;
  captcha_required?: boolean;
  captcha_digest?: string;
  image_url?: string;
  passResponse?: { status_code?: number };
}

export async function campusWebLogin(netId: string, password: string): Promise<CampusWebLoginResponse> {
  const cleanNetId = netId.split('@')[0].trim();
  const res = await fetch('/api/campus-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ net_id: cleanNetId, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Login failed — check your Net ID and password');
  }
  const token = data.cookies || data.token || cleanNetId;
  return { cookies: token, status: '200' };
}

// Campus Web session helpers
export function saveCampusSession(token: string, netId: string) {
  localStorage.setItem('threshold_session', JSON.stringify({
    cookies: token,
    user: netId,
    timestamp: Date.now(),
    source: 'campus_web',
  }));
}

// ── Campus Web data fetching ─────────────────────────────────────

interface CampusWebUserResponse {
  name?: string;
  registrationNumber?: string;
  semester?: string;
  comboBatch?: string[];
  courses?: Array<{
    courseCode?: string;
    courseTitle?: string;
    credit?: string;
    category?: string;
    courseType?: string;
    facultyName?: string;
    slot?: string;
    roomNo?: string;
    academicYear?: string;
    hoursConducted?: string;
    hoursAbsent?: string;
    hoursPresent?: string;
    attendancePercent?: string;
    subject_name?: string;
    subject_type?: string;
    subject_code?: string;
  }>;
  testPerformances?: Array<{
    courseCode?: string;
    courseName?: string;
    courseType?: string;
    totalMarkGot?: number;
    totalMarks?: number;
    tests?: Record<string, unknown>;
    subject_name?: string;
    subject_code?: string;
  }>;
}

export async function fetchCampusWebUser(): Promise<CampusWebUserResponse> {
  const session = getSession();
  if (!session?.cookies) throw new Error('Not logged in');
  const headers: Record<string, string> = { 'X-CSRF-Token': session.cookies };
  if (session.user) headers['X-Net-ID'] = session.user;
  console.log('[fetchCampusWebUser] session:', { cookies: session.cookies?.substring(0, 20) + '...', user: session.user });
  const res = await fetch(`/api/campus-proxy?endpoint=${encodeURIComponent('/api/auth/user/')}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    console.warn('[fetchCampusWebUser] error:', res.status, data);
    if (res.status === 400 || res.status === 401) {
      return { name: session.user || 'Student', courses: [], testPerformances: [] };
    }
    throw new Error(data.message || `Failed to fetch user (${res.status})`);
  }
  const userData = await res.json();
  console.log('[fetchCampusWebUser] success, keys:', Object.keys(userData), 'courses count:', userData.courses?.length, 'testPerformances count:', userData.testPerformances?.length);
  return userData;
}

export async function fetchCampusWebTimetable(comboBatch: string): Promise<unknown> {
  const session = getSession();
  if (!session?.cookies) throw new Error('Not logged in');
  const headers: Record<string, string> = { 'X-CSRF-Token': session.cookies };
  if (session.user) headers['X-Net-ID'] = session.user;
  const res = await fetch(`/api/campus-proxy?endpoint=${encodeURIComponent(`/api/auth/timetable/${comboBatch}`)}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch timetable (${res.status})`);
  return res.json();
}

export async function fetchCampusWebPlanner(): Promise<unknown> {
  const session = getSession();
  if (!session?.cookies) throw new Error('Not logged in');
  const headers: Record<string, string> = { 'X-CSRF-Token': session.cookies };
  if (session.user) headers['X-Net-ID'] = session.user;
  console.log('[fetchCampusWebPlanner] fetching planner');
  const res = await fetch(`/api/campus-proxy?endpoint=${encodeURIComponent('/api/auth/planner')}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch planner (${res.status})`);
  const plannerData = await res.json();
  console.log('[fetchCampusWebPlanner] response:', JSON.stringify(plannerData).substring(0, 500));
  return plannerData;
}

// ── Campus Web adapters: normalize Campus Web data → our app types ──

export async function fetchCampusWebStudentPortalAttendance(netId: string): Promise<AttendanceResponse> {
  const cleanNetId = netId.split('@')[0].trim();
  const session = getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.cookies) headers['X-CSRF-Token'] = session.cookies;
  if (session?.user) headers['X-Net-ID'] = session.user;
  console.log('[fetchCampusWebStudentPortalAttendance] netId:', cleanNetId, 'has CSRF:', !!session?.cookies);
  const res = await fetch(`/api/campus-proxy?endpoint=${encodeURIComponent('/api/student-portal/attendance')}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ net_id: cleanNetId }),
  });
  const rawText = await res.text();
  console.log('[fetchCampusWebStudentPortalAttendance] status:', res.status, 'body:', rawText.substring(0, 500));
  let data: any = {};
  try { data = JSON.parse(rawText); } catch { data = { raw: rawText }; }
  const list = Array.isArray(data.attendance) ? data.attendance : (Array.isArray(data) ? data : []);
  if (res.ok && list.length > 0) {
    return {
      regNumber: cleanNetId,
      attendance: list.map((a: any) => ({
        courseCode: a.courseCode || a.course_code || a.code || a.subjectcode || '',
        courseTitle: a.courseTitle || a.course_name || a.title || a.subjectdesc || '',
        category: a.category || a.type || '',
        facultyName: a.facultyName || a.faculty || '',
        slot: a.slot || '',
        hoursConducted: Number(a.hoursConducted || a.conducted || a.total_hours || a.total) || 0,
        hoursAbsent: Number(a.hoursAbsent || a.absent) || 0,
        attendancePercentage: Number(a.attendancePercentage || a.percentage || a.percent || a.presentpercentage) || 0,
      })),
      status: 200,
    };
  }
  return { regNumber: cleanNetId, attendance: [], status: 200 };
}

export function adaptCampusWebAttendance(user: CampusWebUserResponse | any): AttendanceResponse {
  const courses: any[] = user?.courses || user?.data?.courses || (Array.isArray(user) ? user : []);
  console.log('[adaptCampusWebAttendance] input keys:', Object.keys(user || {}), 'courses count:', courses.length);
  if (courses.length > 0) console.log('[adaptCampusWebAttendance] first course:', JSON.stringify(courses[0]).substring(0, 300));
  const attendance: Attendance[] = courses
    .map((c: any) => {
      const conducted = Number(c.hoursConducted || c.conductedHours || c.total_hours || c.conducted || 0);
      const present = Number(c.hoursPresent || c.presentHours || c.attended_hours || c.present || 0);
      const pct = Number(c.attendancePercent || c.attendance_percentage || c.percentage || c.percent || (conducted > 0 ? (present / conducted) * 100 : 0));
      const absent = Number(c.hoursAbsent || c.absentHours || c.absent) || (conducted > 0 ? conducted - present : 0);
      return {
        courseCode: c.courseCode || c.subject_code || c.course_code || c.code || '',
        courseTitle: c.courseTitle || c.subject_name || c.course_name || c.title || '',
        category: c.category || c.subject_type || c.type || '',
        facultyName: c.facultyName || c.faculty_name || c.faculty || '',
        slot: c.slot || c.room_code || c.roomNo || '',
        hoursConducted: conducted,
        hoursAbsent: Math.max(0, absent),
        attendancePercentage: Math.round(pct * 100) / 100,
      };
    })
    .filter((a) => a.courseCode || a.courseTitle || a.hoursConducted > 0);

  return { regNumber: '', attendance, status: 200 };
}

export function adaptCampusWebPlanner(plannerData: any): CalendarResponse {
  console.log('[adaptCampusWebPlanner] input type:', typeof plannerData, 'keys:', plannerData ? Object.keys(plannerData).slice(0, 5) : []);
  const calendar: CalendarMonth[] = [];

  if (!plannerData || typeof plannerData !== 'object') {
    return { calendar: [], status: 200 };
  }

  // API shape: { "Aug '26": { Data: [...], Holiday: [...], HolidayCount: N }, ... }
  // Each Data item: { Date: "1"|"15", Day: "Mon", Event: "...", Dayorder: "5"|"-" }
  // Holiday: array of day numbers [1, 2, 8]

  for (const [monthKey, monthVal] of Object.entries(plannerData)) {
    const mv = monthVal as any;
    if (!mv || !Array.isArray(mv.Data)) continue;

    // Parse month key like "Aug '26" → month number and year
    const monthMatch = monthKey.match(/(\w+)\s*'(\d{2})/);
    if (!monthMatch) continue;

    const monthStr = monthMatch[1];
    const yearShort = parseInt(monthMatch[2], 10);
    const year = yearShort >= 50 ? 1900 + yearShort : 2000 + yearShort;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIdx = monthNames.indexOf(monthStr);
    if (monthIdx < 0) continue;

    const holidayDays = new Set<number>(Array.isArray(mv.Holiday) ? mv.Holiday.map(Number) : []);
    const mm = String(monthIdx + 1).padStart(2, '0');
    const monthId = `${year}-${mm}`;

    const days: CalendarDay[] = mv.Data.map((item: any) => {
      const dayNum = parseInt(String(item.Date), 10);
      if (isNaN(dayNum)) return null;
      const dd = String(dayNum).padStart(2, '0');
      const isHoliday = holidayDays.has(dayNum) || /holiday/i.test(item.Event || '');
      const dayorder = item.Dayorder || item.DayOrder || item.dayorder || '';
      return {
        date: `${dd}-${mm}-${year}`,
        day: String(dayNum).padStart(2, '0'),
        dayOrder: dayorder === '-' ? '' : `Day ${dayorder}`,
        event: item.Event || item.event || '',
        isHoliday,
      };
    }).filter(Boolean) as CalendarDay[];

    if (days.length > 0) {
      calendar.push({ month: monthId, days });
    }
  }

  console.log('[adaptCampusWebPlanner] calendar months:', calendar.length, 'total days:', calendar.reduce((s, m) => s + m.days.length, 0));
  return { calendar, status: 200 };
}

export function adaptCampusWebMarks(user: CampusWebUserResponse): MarksResponse {
  console.log('[adaptCampusWebMarks] testPerformances count:', user.testPerformances?.length ?? 0, 'data:', JSON.stringify(user.testPerformances).substring(0, 500));
  const marks: Mark[] = (user.testPerformances || []).map((tp) => {
    // Convert Campus Web tests Record to TestPerformance array
    const testPerformance: TestPerformance[] = [];
    if (tp.tests && typeof tp.tests === 'object') {
      for (const [testName, testData] of Object.entries(tp.tests)) {
        if (testData && typeof testData === 'object') {
          const d = testData as Record<string, unknown>;
          // Handle nested marks: { got: X, total: Y } or { scored: X, total: Y }
          const scored = d.got ?? d.scored ?? (d.marks as any)?.scored ?? '';
          const total = d.total ?? (d.marks as any)?.total ?? '';
          testPerformance.push({
            test: testName,
            marks: { scored: String(scored), total: String(total) },
          });
        }
      }
    }
    return {
      courseName: (tp as any).courseName || tp.subject_name || '',
      courseCode: (tp as any).courseCode || tp.subject_code || '',
      courseType: (tp as any).courseType || '',
      overall: {
        scored: String(tp.totalMarkGot ?? ''),
        total: String(tp.totalMarks ?? ''),
      },
      testPerformance,
    };
  });
  return { regNumber: '', marks, status: 200 };
}

export function adaptCampusWebProfile(user: CampusWebUserResponse, netId: string): SpProfileResponse {
  const sem = user.semester ? parseInt(user.semester, 10) : undefined;
  return {
    profile: {
      name: user.name || netId,
      reg_number: user.registrationNumber || netId,
      semester: Number.isFinite(sem) ? sem : undefined,
      batch: Array.isArray(user.comboBatch) ? user.comboBatch.join(',') : (user.comboBatch as any) || undefined,
    },
  };
}

export interface CampusWebTimetableResponse {
  day_order?: string;
  timetable?: Record<string, Record<string, { subject_name: string; subject_type: string; room_code: string }>>;
}

export function adaptCampusWebTimetable(data: CampusWebTimetableResponse, courses: CampusWebUserResponse['courses']): TimetableSlot[] {
  if (!data?.timetable) return [];

  const nameToCourse = new Map<string, { courseCode: string; slot: string; facultyName: string }>();
  for (const c of courses || []) {
    if (c.courseTitle && !nameToCourse.has(c.courseTitle)) {
      nameToCourse.set(c.courseTitle, {
        courseCode: c.courseCode || '',
        slot: c.slot || '',
        facultyName: c.facultyName || '',
      });
    }
  }

  const slots: TimetableSlot[] = [];
  const dayKeys = Object.keys(data.timetable).sort();

  for (const dayKey of dayKeys) {
    const dayMatch = dayKey.match(/Day(\d)/i);
    if (!dayMatch) continue;
    const dayOrder = `DO-${dayMatch[1]}`;
    const timeSlots = data.timetable[dayKey];

    let hourIndex = 0;
    for (const [timeRange, info] of Object.entries(timeSlots)) {
      hourIndex++;
      if (!info || info.subject_name === 'No class') continue;
      const mapped = nameToCourse.get(info.subject_name);
      slots.push({
        day: dayOrder,
        hour: hourIndex,
        time: timeRange,
        courseCode: mapped?.courseCode || '',
        courseTitle: info.subject_name,
        slot: mapped?.slot || '',
        faculty: mapped?.facultyName || '',
        room: info.room_code || '',
      });
    }
  }

  return slots;
}
