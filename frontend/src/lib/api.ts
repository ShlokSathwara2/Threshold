const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://threshold-1-ly01.onrender.com';

import { userHash, isPlaceholderUser, migrateLegacyIdentity, scopedKey } from './user-scope';

export interface Session {
  cookies: string;
  user: string;
  timestamp: number;
  source?: 'sp' | 'campus_web';
  // Academia (IAM) token captured during a Campus Web login. /api/auth/user/
  // only returns the component-wise `tests` breakdown (and /api/auth/planner
  // only works) when requests carry THIS token instead of the sp_session.
  academiaToken?: string;
}

// Academia session — persisted in localStorage (scoped per login) so a student
// signs in to Academia ONCE and the timetable / calendar / component-wise marks
// keep working across app restarts without another Academia login. The legacy
// per-tab sessionStorage copy is migrated on first load.
const ACADEMIA_STORAGE_KEY = 'threshold_academia_session';
// The semester the saved Academia session was captured in. An Academia session
// outlives a semester, so when the portal rolls over to the next one the saved
// timetable (and day order) go stale. Stamping the semester lets us notice the
// rollover and ask the student to sign in again.
const ACADEMIA_SEMESTER_KEY = 'threshold_academia_semester';
// Set when we sign the student out *because of* a semester rollover, so any
// page that renders the Academia login card can explain why.
const ACADEMIA_RELOGIN_KEY = 'threshold_academia_relogin';
let academiaCookie: string | null = null;
let academiaUsername: string | null = null;

function academiaStorageKey(): string {
  try {
    return scopedKey(ACADEMIA_STORAGE_KEY);
  } catch {
    return ACADEMIA_STORAGE_KEY;
  }
}

function academiaSemesterKey(): string {
  try {
    return scopedKey(ACADEMIA_SEMESTER_KEY);
  } catch {
    return ACADEMIA_SEMESTER_KEY;
  }
}

function academiaReloginKey(): string {
  try {
    return scopedKey(ACADEMIA_RELOGIN_KEY);
  } catch {
    return ACADEMIA_RELOGIN_KEY;
  }
}

function persistAcademia() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      academiaStorageKey(),
      JSON.stringify({ cookie: academiaCookie, username: academiaUsername })
    );
  } catch { /* non-fatal */ }
}

// Restore on module load so a cold app start already has the Academia session.
if (typeof window !== 'undefined') {
  try {
    const raw =
      localStorage.getItem(academiaStorageKey()) ||
      sessionStorage.getItem(ACADEMIA_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      academiaCookie = parsed.cookie || null;
      academiaUsername = parsed.username || null;
      // Migrate the legacy per-tab copy into persistent, user-scoped storage.
      if (academiaCookie && !localStorage.getItem(academiaStorageKey())) persistAcademia();
    }
  } catch { /* corrupted — ignore */ }
}

// Read the Academia session saved for the CURRENT login. Reading from the
// scoped key (instead of trusting a copy loaded once at import) means that
// after an explicit logout + login the SAME student's saved Academia session
// is picked straight back up — while a different login, scoped to its own key,
// still sees nothing.
function readAcademiaStored(): { cookie: string | null; username: string | null } {
  if (typeof window === 'undefined') {
    return { cookie: academiaCookie, username: academiaUsername };
  }
  try {
    const raw = localStorage.getItem(academiaStorageKey());
    if (raw) {
      const parsed = JSON.parse(raw);
      return { cookie: parsed?.cookie ?? null, username: parsed?.username ?? null };
    }
  } catch {
    /* ignore */
  }
  return { cookie: academiaCookie, username: academiaUsername };
}

export function getAcademiaCookies(): string | null {
  return readAcademiaStored().cookie;
}

export function getAcademiaUsername(): string | null {
  return readAcademiaStored().username;
}

export function setAcademiaCookies(cookies: string, username?: string, semester?: number | null) {
  academiaCookie = cookies;
  if (username) academiaUsername = username;
  // Persist to localStorage so the Academia session (and every feature it
  // unlocks) survives app restarts and session expiry.
  persistAcademia();
  // Stamp the semester we logged in for, when we already know it. On a later
  // app launch the rollover check compares against this.
  if (semester !== undefined && semester !== null && Number.isFinite(semester)) {
    setAcademiaSemester(semester);
  }
  // Signing in again resolves the rollover — drop any "please sign in again" note.
  clearAcademiaReloginNotice();
}

export function clearAcademiaCookies() {
  academiaCookie = null;
  academiaUsername = null;
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(academiaStorageKey());
      localStorage.removeItem(academiaSemesterKey());
      localStorage.removeItem(academiaReloginKey());
      sessionStorage.removeItem(ACADEMIA_STORAGE_KEY);
    } catch { /* non-fatal */ }
  }
}

// ── Semester rollover ───────────────────────────────────────────────────────

/** The semester the saved Academia session was captured in (if known). */
export function getAcademiaSemester(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(academiaSemesterKey());
    if (!raw) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function setAcademiaSemester(semester: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(academiaSemesterKey(), String(semester));
  } catch { /* non-fatal */ }
}

export interface AcademiaReloginNotice {
  from?: number;
  to?: number;
  at: number;
}

/** Why we signed the student out of Academia, if it was a semester rollover. */
export function getAcademiaReloginNotice(): AcademiaReloginNotice | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(academiaReloginKey());
    return raw ? (JSON.parse(raw) as AcademiaReloginNotice) : null;
  } catch {
    return null;
  }
}

function setAcademiaReloginNotice(notice: AcademiaReloginNotice): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(academiaReloginKey(), JSON.stringify(notice));
  } catch { /* non-fatal */ }
}

export function clearAcademiaReloginNotice(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(academiaReloginKey());
  } catch { /* non-fatal */ }
}

// Drop every cached timetable / calendar so the fresh semester's data is
// fetched after the student signs in again. Caches live under
// `threshold_cache__<scope>__<namespace>`, plus the login-scoped timetable key.
function clearTimetableCaches(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(scopedKey('threshold_timetable_cache'));
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('threshold_cache__')) continue;
      if (key.endsWith('__timetable') || key.endsWith('__calendar')) doomed.push(key);
    }
    for (const key of doomed) localStorage.removeItem(key);
  } catch { /* non-fatal */ }
}

export interface AcademiaSemesterCheck {
  changed: boolean;
  previous?: number;
  current?: number;
}

/**
 * Keep the saved Academia session in step with the portal's current semester.
 *
 * - No saved Academia session → nothing to do.
 * - Session saved but no semester stamp yet (an install from before this
 *   feature, or a login where the semester wasn't known) → adopt the current
 *   semester without forcing another login.
 * - Stamp differs from the current semester → the timetable / day order belong
 *   to the previous semester. Clear the Academia session and cached timetable
 *   and report `changed: true` so the UI asks the student to sign in again.
 */
export function syncAcademiaSemester(current?: number | null): AcademiaSemesterCheck {
  if (current === undefined || current === null || !Number.isFinite(current)) {
    return { changed: false };
  }
  if (!isAcademiaLoggedIn()) return { changed: false };

  const previous = getAcademiaSemester();
  if (previous === null) {
    setAcademiaSemester(current);
    return { changed: false };
  }
  if (previous !== current) {
    clearAcademiaCookies();
    clearTimetableCaches();
    setAcademiaReloginNotice({ from: previous, to: current, at: Date.now() });
    return { changed: true, previous, current };
  }
  return { changed: false };
}

export function isAcademiaLoggedIn(): boolean {
  // Read through the scoped key so the answer is correct even after a logout +
  // re-login (or an in-app identity upgrade) changed which key holds it.
  return !!readAcademiaStored().cookie;
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
  // Let any mounted view re-read identity-scoped data without a reload — this
  // is how a preserved Academia session reappears the moment the fast-login
  // identity resolves (instead of the user being asked to log in again).
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('threshold:identity-changed'));
    }
  } catch {
    /* ignore */
  }
  return true;
}

export function isLoggedIn(): boolean {
  return getSession() !== null;
}

// Wake the backend (Render free tier cold-starts) while the student is still
// answering the CAPTCHA, so the first real data call after login is warm.
export function warmUpBackend(): void {
  try {
    void fetch(`${API_BASE}/hello`, { method: 'GET', cache: 'no-store' }).catch(() => {});
  } catch {
    /* ignore */
  }
}

// Save the session immediately and let the caller navigate right away: the
// profile round-trip that resolves the real identity runs in the background
// and upgrades the per-login scoped keys when it lands. This removes a full
// backend round-trip from the post-CAPTCHA login path.
export function saveSessionFast(cookies: string, fallbackUser = ''): string {
  const user = fallbackUser || 'student';
  try {
    localStorage.setItem('threshold_session', JSON.stringify({ cookies, user, timestamp: Date.now() }));
  } catch {
    /* ignore */
  }
  void resolveSessionUser(cookies)
    .then((identity) => {
      if (identity) upgradeSessionUser(identity);
    })
    .catch(() => {});
  return user;
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
  /** Campus Web reports a per-component percentage (e.g. "73.4"). */
  percentage?: string;
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
  /** Student-Portal subject id + status — needed for the component drill-down. */
  subjectId?: string;
  status?: string;
}

export interface InternalMarkComponent {
  component: string;
  scored: string;
  maxMark: string;
  enteredOn?: string;
}

export interface InternalMarksResponse {
  internal_marks: InternalMark[];
  error?: string;
}

export async function fetchSpInternalMarks(): Promise<InternalMarksResponse> {
  return apiFetch('/sp/internal-marks');
}

/**
 * Component-wise breakdown for one subject ("View Details" on the SRM portal).
 * The ids come from the marks row itself (subjectId + status + code + desc).
 */
export async function fetchSpInternalMarksDetail(
  subjectId: string,
  status: string,
  code = '',
  desc = ''
): Promise<{ components: InternalMarkComponent[]; attempts?: string[] }> {
  const res = await apiFetch<{
    components?: InternalMarkComponent[];
    error?: string;
    attempts?: string[];
  }>('/sp/internal-marks-detail', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject_id: subjectId, status, code, desc }),
  });
  // The backend answers HTTP 200 even for its own failures, so a body-level
  // `error` has to become a real throw — otherwise the UI shows the
  // misleading "no component marks published yet" empty state.
  if (res?.error) throw new Error(res.error);
  return { components: res?.components || [], attempts: res?.attempts };
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
  academiaToken?: string;
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
  let res: Response;
  try {
    res = await fetch('/api/campus-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ net_id: cleanNetId, password }),
      // The route has its own upstream timeouts; this is the outer ceiling so
      // the button can never spin forever on a stalled request.
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    throw new Error(
      timedOut
        ? 'Login is taking longer than usual — tap Log in to try again.'
        : 'Could not reach the server — check your connection and try again.'
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Login failed — check your Net ID and password');
  }
  const token = data.cookies || data.token;
  if (!token) {
    // Never fall back to the Net ID: a session key that is not a real token
    // would "log in" successfully and then break every data fetch.
    throw new Error(data.message || 'Login failed — no session token received. Please try again.');
  }
  return { cookies: token, academiaToken: data.academiaToken || undefined, status: '200' };
}

// Campus Web session helpers
export function saveCampusSession(token: string, netId: string, academiaToken?: string) {
  localStorage.setItem('threshold_session', JSON.stringify({
    cookies: token,
    user: netId,
    timestamp: Date.now(),
    source: 'campus_web',
    ...(academiaToken ? { academiaToken } : {}),
  }));
}

// Academia (IAM) token captured at Campus Web login, if any. Used for the
// /api/auth/* endpoints that need it (component-wise marks, planner).
export function getCampusAcademiaToken(): string | null {
  const session = getSession();
  if (session?.source !== 'campus_web') return null;
  return session.academiaToken || null;
}

// Headers for a Campus Web /api/auth/* call: prefer the Academia token (the
// only one that unlocks component-wise marks + planner), fall back to the
// sp_session so older sessions keep working.
function campusAuthHeaders(): Record<string, string> {
  const session = getSession();
  if (!session) return {};
  const headers: Record<string, string> = {
    'X-CSRF-Token': session.academiaToken || session.cookies,
  };
  if (session.user) headers['X-Net-ID'] = session.user;
  return headers;
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
  // Prefer the Academia token: /api/auth/user/ only fills in the component-wise
  // `tests` breakdown (FT-I, FT-II …) when it is used instead of the sp_session.
  const headers = campusAuthHeaders();
  console.log('[fetchCampusWebUser] session:', {
    csrf: (headers['X-CSRF-Token'] || '').substring(0, 20) + '...',
    user: session.user,
    academiaToken: !!session.academiaToken,
  });
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
  const headers = campusAuthHeaders();
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
  // The planner needs an Academia session; campusAuthHeaders() already prefers
  // the academia token captured at login.
  const headers = campusAuthHeaders();
  // Also forward a separately-signed-in Academia session when present.
  const academia = getAcademiaCookies();
  if (academia) headers['X-Academia-Token'] = academia;
  console.log('[fetchCampusWebPlanner] fetching planner, academia session:', !!academia || !!session.academiaToken);
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

/**
 * Exam timetable for a Campus Web (Net ID) session. Mirrors
 * `fetchCampusWebStudentPortalAttendance`: POST the Net ID and map the
 * portal's `examTimeTable` rows onto our ExamTimetableRow shape, so the Exam
 * Timetable page renders a Net ID login exactly like the Student Portal one.
 */
export async function fetchCampusWebExamTimetable(netId: string): Promise<ExamTimetableResponse> {
  const cleanNetId = netId.split('@')[0].trim();
  const session = getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.cookies) headers['X-CSRF-Token'] = session.cookies;
  if (session?.user) headers['X-Net-ID'] = session.user;
  try {
    const res = await fetch(
      `/api/campus-proxy?endpoint=${encodeURIComponent('/api/student-portal/exam-timetable')}`,
      { method: 'POST', headers, body: JSON.stringify({ net_id: cleanNetId }) }
    );
    const rawText = await res.text();
    let data: any = {};
    try { data = JSON.parse(rawText); } catch { data = {}; }
    const list: any[] = Array.isArray(data.examTimeTable) ? data.examTimeTable : [];
    return {
      available: list.length > 0,
      rows: list.map((e: any) => ({
        sem_year_trim: e.semester || '',
        subject_code: e.course_code || '',
        subject_description: e.course_name || '',
        date_session:
          e.date_session ||
          [e.date, e.session, e.time ? `(${e.time})` : ''].filter(Boolean).join(' '),
        hall_no: e.hall_no || '',
        seat_no: e.seat_no || '',
      })),
    };
  } catch (e) {
    return {
      available: false,
      rows: [],
      error: e instanceof Error ? e.message : 'Failed to load exam timetable',
    };
  }
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
          const percentage = d.percentage ?? (d.marks as any)?.percentage;
          testPerformance.push({
            test: testName,
            marks: { scored: String(scored), total: String(total) },
            ...(percentage !== undefined && percentage !== null ? { percentage: String(percentage) } : {}),
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
