# Campus Web (campusweb.in) — Flow Reference

> Deep scan of The Campus Web — SRM's student companion web app + Android/iOS apps.
> Recovered from live site HTML, Next.js JS bundles, and on-device inspection.
> Last verified: 2026-08-19

---

## Architecture Overview

| Layer | Tech | Location |
|---|---|---|
| Web frontend | Next.js (App Router, static/SSR pages) | Vercel (`campusweb.vercel.app`) |
| Backend API | Single Python/Node service (proxies SRM) | `https://campusapi.fly.dev` (Fly.io) |
| Android app | `com.campusweb.campusapp` | Google Play Store |
| iOS app | `id6760725730` | Apple App Store |

**Key design decision:** the browser NEVER talks to `sp.srmist.edu.in`.
All SRM scraping happens server-side on `campusapi.fly.dev`. The frontend
only calls `/api/*` endpoints and passes an opaque session token.

The JS bundle defines 10 "server" constants (`v2`, `p7`, `_2`, `LS`, `hF`,
`rQ`, `SX`, `OK`, `eR`, `ni`) — all of them are `https://campusapi.fly.dev`.
On failure the client shuffles the list and retries, so the failover is
effectively "retry the same server".

---

## Student Login Flow

```
campusweb.in/login  (also /client/login/student)
```

1. User enters Net ID + password.
   - Net ID gets `@srmist.edu.in` auto-appended if it contains no `@`.
2. `POST https://campusapi.fly.dev/api/auth/login/`
   - Headers: `Content-Type: application/json`
   - Body: `{ "username": "...", "password": "..." }`
3. Success detection:
   - `passResponse.status_code === 201`, or
   - `status === "success"` / `status === "Status"`
4. Session token is read from (first match wins):
   `cookies | Cookies | COOKIE | cookie | X-CSRF-Token`
5. Token is stored as a browser cookie named **`X-CSRF-Token`**
   (expires in 365 days) and the app redirects to `/student`.
6. On mount, `/login` checks `X-CSRF-Token` exists → straight to `/student`.

### Special error handling

| Response | UI behaviour |
|---|---|
| `passResponse.message == "Matched with old password"` | "You've entered an old password. Please enter your current password." |
| `message == "Invalid password"` | "Invalid password" |
| anything else | "Something went wrong! Trying another server..." (shuffles + retries) |
| all servers fail | "Login failed - Unable to connect to any server." |

---

## Data Endpoints (all behind `X-CSRF-Token` header)

### `GET /api/auth/user`
Student identity + standings data.

- **Response shape:** `{ name, courses[], testPerformances[], comboBatch[] }`
  - `courses[]`: `{ attendancePercent, hoursConducted, ... }`
  - `comboBatch[]`: last element is used for the timetable call
- **Client caching:** stored in `localStorage.studentData`
- **Fallbacks:** `500` → name defaults to `"John Doe"`; `429` → "Too many requests. Try again in a min."

### `GET /api/auth/timetable/{comboBatch}`
Day-wise timetable.

- **Response shape:** `{ timetable: { "Day1": { "08:00": { subject_name, subject_type, room_code } }, ... }, day_order }`
- **Client caching:** `localStorage.studentTimetable`
- Rendered as 5-10 period cells per day, day-order tab bar (`Day1..Day6`).

### `GET /api/auth/feedback` / `POST /api/auth/feedback`
Course feedback system (SRM mandatory feedback).

- GET returns `{ available, completed, totalCourses, pendingCourseCount, theoryCourses[], practicalCourses[], ratings[], canSubmit, ... }`
- POST body: `{ rating, comment }`
- `401` → session expired (removes `X-CSRF-Token`, redirects to login)
- `409` → feedback already completed

### `GET /api/auth/logoutuser/`
Logout. Frontend then clears `localStorage` + `X-CSRF-Token` cookie, redirects `/`.

### `GET /api/users/allevent`
Public club events carousel (no auth). Fields: `{ club_name, title, dates, banner_url, logo, website_link }`.
Dates come as `"YYYY-MM-DD to YYYY-MM-DD"` strings, parsed client-side.

---

## Client-side behaviour notes

- **Standings cards** are computed client-side:
  - Attendance % = average of `attendancePercent` across courses with `hoursConducted > 0`
  - Marks = sum of `testPerformance[].totalMarkGot` / sum of `totalMarks`
- **Caches:** `studentData`, `studentTimetable` persist in localStorage;
  `studentCalendar` is removed on every dashboard visit (forces refetch).
- **PWA:** `manifest.json`, install prompt via `beforeinstallprompt`,
  Apple meta tags for iOS home-screen install.
- **Ads/sponsors:** sponsored event carousel (CODENEX day-zero promos etc.).
- **Club Organiser:** separate auth at `/client/login/club/` (own token path, `clubLoggedIn` cookie).

---

## Notable weaknesses observed

- "10 servers" failover is fake — same URL 10 times.
- `X-CSRF-Token` is just the SP session cookie string shipped to the client
  and accepted verbatim on every endpoint (no rotation, no scoping).
- 429 rate limiting exists but is surfaced as a toast, no backoff.
- No academia (academics.srmist.edu.in) support at all.
- No offline data beyond raw localStorage snapshots (no derived/forecast state).