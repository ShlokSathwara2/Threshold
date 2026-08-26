const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

import { userHash, isPlaceholderUser, migrateLegacyIdentity } from './user-scope';

export interface Session {
  cookies: string;
  user: string;
  timestamp: number;
  source?: 'sp' | 'campus_web';
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
  courses?: Array<{
    subject_name?: string;
    subject_type?: string;
    hoursConducted?: string;
    hoursPresent?: string;
    attendancePercent?: string;
    room_code?: string;
    subject_code?: string;
  }>;
  testPerformances?: Array<{
    totalMarkGot?: number;
    totalMarks?: number;
    subject_name?: string;
    subject_code?: string;
  }>;
  comboBatch?: string[];
}

export async function fetchCampusWebUser(): Promise<CampusWebUserResponse> {
  const session = getSession();
  if (!session?.cookies) throw new Error('Not logged in');
  const headers: Record<string, string> = { 'X-CSRF-Token': session.cookies };
  if (session.user) headers['X-Net-ID'] = session.user;
  const res = await fetch(`/api/campus-proxy?endpoint=${encodeURIComponent('/api/auth/user/')}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch user (${res.status})`);
  return res.json();
}

export async function fetchCampusWebTimetable(comboBatch: string): Promise<unknown> {
  const session = getSession();
  if (!session?.cookies) throw new Error('Not logged in');
  const headers: Record<string, string> = { 'X-CSRF-Token': session.cookies };
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
  const res = await fetch(`/api/campus-proxy?endpoint=${encodeURIComponent('/api/auth/planner')}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch planner (${res.status})`);
  return res.json();
}

// ── Campus Web adapters: normalize Campus Web data → our app types ──

export async function fetchCampusWebStudentPortalAttendance(netId: string): Promise<AttendanceResponse> {
  const cleanNetId = netId.split('@')[0].trim();
  const session = getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.cookies) headers['X-CSRF-Token'] = session.cookies;
  if (session?.user) headers['X-Net-ID'] = session.user;
  const res = await fetch(`/api/campus-proxy?endpoint=${encodeURIComponent('/api/student-portal/attendance')}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ net_id: cleanNetId }),
  });
  const data = await res.json().catch(() => ({}));
  const list = Array.isArray(data.attendance) ? data.attendance : (Array.isArray(data) ? data : []);
  if (res.ok && list.length > 0) {
    return {
      regNumber: cleanNetId,
      attendance: list.map((a: any) => ({
        courseCode: a.courseCode || a.course_code || a.code || '',
        courseTitle: a.courseTitle || a.course_name || a.title || '',
        category: a.category || a.type || '',
        facultyName: a.facultyName || a.faculty || '',
        slot: a.slot || '',
        hoursConducted: Number(a.hoursConducted || a.conducted || a.total_hours) || 0,
        hoursAbsent: Number(a.hoursAbsent || a.absent) || 0,
        attendancePercentage: Number(a.attendancePercentage || a.percentage || a.percent) || 0,
      })),
      status: 200,
    };
  }
  return { regNumber: cleanNetId, attendance: [], status: 200 };
}

export function adaptCampusWebAttendance(user: CampusWebUserResponse | any): AttendanceResponse {
  const courses: any[] = user?.courses || user?.data?.courses || (Array.isArray(user) ? user : []);
  const attendance: Attendance[] = courses
    .map((c: any) => {
      const conducted = Number(c.hoursConducted || c.conductedHours || c.total_hours || c.conducted || 0);
      const present = Number(c.hoursPresent || c.presentHours || c.attended_hours || c.present || 0);
      const pct = Number(c.attendancePercent || c.attendance_percentage || c.percentage || c.percent || (conducted > 0 ? (present / conducted) * 100 : 0));
      const absent = conducted > 0 ? conducted - present : Number(c.hoursAbsent || c.absentHours || c.absent || 0);
      return {
        courseCode: c.subject_code || c.course_code || c.code || '',
        courseTitle: c.subject_name || c.course_name || c.title || '',
        category: c.subject_type || c.category || c.type || '',
        facultyName: c.faculty_name || c.faculty || '',
        slot: c.slot || c.room_code || '',
        hoursConducted: conducted,
        hoursAbsent: Math.max(0, absent),
        attendancePercentage: Math.round(pct * 100) / 100,
      };
    })
    .filter((a) => a.courseCode || a.courseTitle || a.hoursConducted > 0);

  return { regNumber: '', attendance, status: 200 };
}

export function adaptCampusWebPlanner(plannerData: any): CalendarResponse {
  const items: any[] = Array.isArray(plannerData) ? plannerData : (plannerData?.planner || plannerData?.calendar || plannerData?.data || []);
  const monthsMap = new Map<string, CalendarDay[]>();

  for (const item of items) {
    const rawDate = item.date || item.Date || '';
    if (!rawDate) continue;

    const dateObj = new Date(rawDate);
    if (isNaN(dateObj.getTime())) continue;

    const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
    const dayNum = dateObj.getDate();

    if (!monthsMap.has(monthKey)) {
      monthsMap.set(monthKey, []);
    }

    const days = monthsMap.get(monthKey)!;
    days.push({
      date: String(dayNum).padStart(2, '0'),
      day: String(dayNum),
      dayOrder: item.dayOrder || item.day_order || item.dayOrderName || '',
      event: item.event || item.eventName || item.description || '',
      isHoliday: Boolean(item.is_holiday || item.isHoliday || item.holiday || String(item.event || '').toLowerCase().includes('holiday')),
    });
  }

  const calendar: CalendarMonth[] = Array.from(monthsMap.entries()).map(([monthName, days]) => ({
    month: monthName,
    days: days.sort((a, b) => Number(a.date) - Number(b.date)),
  }));

  return { calendar, status: 200 };
}

export function adaptCampusWebMarks(user: CampusWebUserResponse): MarksResponse {
  const marks: Mark[] = (user.testPerformances || []).map((tp) => ({
    courseName: tp.subject_name || '',
    courseCode: tp.subject_code || '',
    courseType: '',
    overall: {
      scored: String(tp.totalMarkGot ?? ''),
      total: String(tp.totalMarks ?? ''),
    },
    testPerformance: [],
  }));
  return { regNumber: '', marks, status: 200 };
}

export function adaptCampusWebProfile(user: CampusWebUserResponse, netId: string): SpProfileResponse {
  return {
    profile: {
      name: user.name || netId,
      reg_number: netId,
    },
  };
}
