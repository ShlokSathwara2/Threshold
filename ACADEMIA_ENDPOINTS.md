# SRM Academia — Endpoint Reference

> Cross-referenced from: `thirudan`, `goscraper`, `vcademia-api`, `reddy-api-srm`, and live portal HTML.
> Last verified: 2026-08-15

---

## Base URL

```
https://academia.srmist.edu.in
```

Academia is built on **Zoho Creator**. All data pages are served under the `srm_university/academia-academic-services/page/` path.

---

## Constants

| Name | Value | Notes |
|------|-------|-------|
| Portal ID | `10002227248` | Used in login, logout, captcha, session URLs |
| Service Name | `ZohoCreator` | Sent in login form |
| Service URL | `https://academia.srmist.edu.in/` | Post-login redirect target |
| Attendance Page | `My_Attendance` | ⚠️ Returns **403 "Page inaccessible"** for ODD 2026-27 (see below) |
| Course Page | `My_Time_Table_2023_24` | ✅ Verified 200 — courses, user profile, timetable source |
| Unified Timetable (Batch N) | `Unified_Time_Table_2025_Batch_{N}` | ✅ Verified 200 for batch 1; **batch 2+ uses lowercase `_batch_{N}`** (config has `lower=True` variant) |
| Calendar Page | `Academic_Planner_2026_27_ODD` | ✅ Verified 200 — current semester's planner (per-semester naming) |

> **⚠️ Page names change each semester.** Verified live 2026-08-17:
> - `My_Attendance`, `Academic_Planner_2025_26_EVEN`, `Common_Time_Table_Batch_1/2`, `Unified_Timetable_Batch_1` → **all 403/404** (renamed/removed)
> - `My_Time_Table_2023_24`, `Unified_Time_Table_2025_Batch_1`, `Academic_Planner_2026_27_ODD` → **200 OK**
> - Full inventory available by scanning the portal root HTML (`/srm_university/academia-academic-services/`) for page names.

---

## Authentication Flow

### Step 1 — Initial Login

```
POST https://academia.srmist.edu.in/accounts/signin.ac
Content-Type: application/x-www-form-urlencoded
```

**Form fields:**

| Field | Value |
|-------|-------|
| `username` | `{netid}@srmist.edu.in` (full email) |
| `password` | Student password |
| `client_portal` | `true` |
| `portal` | `10002227248` |
| `servicename` | `ZohoCreator` |
| `serviceurl` | `https://academia.srmist.edu.in/` |
| `is_ajax` | `true` |
| `grant_type` | `password` |
| `service_language` | `en` |
| `cdigest` | *(only if captcha was triggered)* |
| `captcha` | *(only if captcha was triggered)* |

**Response (success):**
```json
{
  "status": "success",
  "data": {
    "access_token": "...",
    "oauthorize_uri": "https://academia.srmist.edu.in/accounts/p/10002227248/authorize?..."
  }
}
```

**Response (captcha required):**
```json
{
  "status": "fail",
  "code": "HIP_REQUIRED",
  "message": "...",
  "cdigest": "abc123digest"
}
```

**Response (concurrent session):**
HTML page with "terminate" form — must POST to terminate existing session, then retry login.

**Response (bad credentials):**
```json
{
  "error": {
    "msg": "Invalid username or password"
  }
}
```

### Step 2 — Follow Redirect (Establish Session)

```
GET {oauthorize_uri}&access_token={access_token}
```

This returns `Set-Cookie` headers including `JSESSIONID`. **This JSESSIONID is the session token for all subsequent requests.**

### Step 3 — Captcha (if triggered)

```
GET https://academia.srmist.edu.in/accounts/p/40-10002227248/webclient/v1/captcha/{cdigest}?darkmode=false
```

Returns a captcha image. User solves it, then re-POSTs to `/accounts/signin.ac` with the `cdigest` and `captcha` fields added.

---

## Required Headers for Data Requests

After login, all page requests use these headers:

```
Accept: */*
Accept-Language: en-US,en;q=0.9
Connection: keep-alive
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
Referer: https://academia.srmist.edu.in/
Sec-Fetch-Dest: empty
Sec-Fetch-Mode: cors
Sec-Fetch-Site: same-origin
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36
X-Requested-With: XMLHttpRequest
Cookie: {session_cookies_from_login}
```

---

## Data Endpoints

### 1. Attendance + Marks

```
GET https://academia.srmist.edu.in/srm_university/academia-academic-services/page/My_Attendance
```

**Auth:** Session cookie (`JSESSIONID`)

**Returns:** HTML page with two tables embedded:
- **Attendance table** — `bgcolor="#FAFAD2"` table with `bgcolor="#E6E6FA"` cells for course codes
- **Marks table** — nested within the same page, separated by `</table></td>`

**Attendance fields per row:**
| Column | Field |
|--------|-------|
| 0 | Course Code (e.g. `CSE3005 Regular`) |
| 1 | Course Title |
| 2 | Category (Professional Core, Elective, etc.) |
| 3 | Faculty Name |
| 4 | Slot (e.g. `A1+TA1`) |
| 5 | Hours Conducted |
| 6 | Hours Absent |
| — | Percentage = (conducted - absent) / conducted × 100 |

**Marks fields per row:**
| Column | Field |
|--------|-------|
| 0 | Course Code |
| 1 | Course Type (Theory / Practical) |
| 2 | Test cells — each format: `TestName/Total.00Scored.00` |

---

### 2. Courses + User Profile + Timetable Source

```
GET https://academia.srmist.edu.in/srm_university/academia-academic-services/page/My_Time_Table_2023_24
```

**Auth:** Session cookie

**Returns:** HTML page with multiple tables:

**Course table** (`class="course_tbl"`):
| Column | Field |
|--------|-------|
| 0 | S.No |
| 1 | Course Code |
| 2 | Course Title |
| 3 | Credits |
| 4 | Category |
| 5 | Course Category |
| 6 | Type (Theory/Practical) |
| 7 | Faculty |
| 8 | Slot (e.g. `A1+TA1`) |
| 9 | Room |
| 10 | Academic Year |

**User profile table** (`style="width:900px"`):
| Key | Field |
|-----|-------|
| Name | Student name |
| Program | Degree program |
| Combo / Batch | Batch number (used for timetable derivation) |
| Mobile | Phone number |
| Semester | Current semester |
| Department | Department + Section |

**Timetable derivation:** Timetable is NOT a direct endpoint — it's derived from the courses' slot values + the student's batch number against a slot-to-day/hour matrix.

---

### 2b. Unified Timetable (batch grid) — VERIFIED 2026-08-17

```
GET https://academia.srmist.edu.in/srm_university/academia-academic-services/page/Unified_Time_Table_2025_Batch_1
```

**Auth:** Session cookie

**Returns:** HTML with a single grid table. **Layout confirmed:**
- **Rows = Day 1..5** (the "Day Order" rows; label cells contain `Day 1` ... `Day 5`)
- **Columns = Hour 1..12** (header row: `Hour/Day Order` then `1 2 3 ... 12`)
- **Cells = slot codes** per (day, hour): theory slots (`A`, `A / X`, `F / X`, `B`, `G`), practicals (`P6`, `P7`...), labs (`L11`, `L12`...)
- Cell background colors: `#F9E79F` (theory), `LightGreen` (practical), `DodgerBlue` (lab), `#F8C471` (day/hour label row), `#F1948A` (time-of-day legend)
- `X` suffix on a slot (e.g. `A / X`, `P12/X`) marks an alternate/shared-hour slot code

**Backend parser flow (`parser.py::parse_unified_timetable`):** grid `{(day_num, hour_num): [slot_codes]}` + reverse map `slot_code → [(day, hour)]`, then `workflow.py::_unified_schedule` matches each course's slot (e.g. `A1`, `L21`) to its grid positions. Batch comes from `/user` (course page). **Batch 2 grid name is lowercase `Unified_Time_Table_2025_batch_2`.**

---

### 3. Calendar / Academic Planner

```
GET https://academia.srmist.edu.in/srm_university/academia-academic-services/page/Academic_Planner_2025_26_EVEN
```

**Auth:** Session cookie + special headers:
```
Cache-Control: public, max-age=3600, stale-while-revalidate=7200
```

Also requires these cookies added to the session:
```
ZCNEWUIPUBLICPORTAL=true; cli_rgn=IN
```

**Returns:** Either:
- Direct HTML table with `bgcolor=` attributes, OR
- Hex-encoded payload in `zmlvalue="..."` attribute (must decode hex → HTML entities → HTML)

**Calendar fields per row:**
| Column | Field |
|--------|-------|
| 0 | Date (day number) |
| 1 | Day (Mon/Tue/Wed...) |
| 2 | Event (Holiday name or empty) |
| 3 | Day Order (1-5 or holiday marker) |

Months are column groups (Jan, Feb, Mar, etc.) with `'25` or `'26` year suffix.

---

### 4. Logout

```
GET https://academia.srmist.edu.in/accounts/p/10002227248/logout?servicename=ZohoCreator&serviceurl=https://academia.srmist.edu.in/
```

**Auth:** Session cookie

**Returns:** 302 redirect or 200

---

### 5. Terminate Active Sessions

```
DELETE https://academia.srmist.edu.in/accounts/p/10002227248/webclient/v1/account/self/user/self/activesessions
```

**Auth:** Session cookie

Used when login returns "concurrent session" conflict.

---

## Session Management

- Session is a `JSESSIONID` cookie
- No explicit expiry observed — dies on server-side timeout or logout
- Must store only the cookie string client-side, never the password
- Re-login required when session expires (auto-logout in app)

---

## Parsing Notes

- All data pages return **HTML** (not JSON) — must parse with BeautifulSoup/cheerio
- Attendance and Marks share the same page (`My_Attendance`)
- Courses, User, and Timetable source share the same page (`My_Time_Table_*`)
- Calendar page name changes per semester
- The calendar may return hex-encoded HTML that needs decoding
- Marks test format: `TestName/Total.00Scored.00` (e.g. `Internal-1/20.0015.00`)
- "Abs" appears in marks for absent/missed tests

---

## What You Must Verify Manually (DevTools)

Before writing code, log in yourself and confirm:

1. [ ] Current page names (especially Calendar — changes per semester)
2. [ ] Whether login still returns `access_token` + `oauthorize_uri` pattern
3. [ ] Whether captcha is still triggered and the `cdigest`/`captcha` flow
4. [ ] Exact HTML structure of attendance, marks, courses, and calendar tables
5. [ ] Whether any new anti-scraping measures (rate limiting, bot detection) exist
6. [ ] Session cookie name and expiry behavior
7. [ ] Calendar page encoding (direct HTML vs hex-encoded)

---

## Reference Projects

| Project | Language | Key Insight |
|---------|----------|-------------|
| [thirudan](https://github.com/EX3CU7I0N3R/thirudan) | Python/FastAPI | Cleanest login flow, captcha handling, concurrent session termination |
| [goscraper](https://github.com/suduolabs/goscraper) | Go/Fiber | Used by ClassPro production app, Supabase caching |
| [vcademia-api](https://github.com/mvishok/vcademia-api) | Python/Flask | Swagger docs, Vercel deployment reference |
| [reddy-api-srm](https://www.npmjs.com/package/reddy-api-srm) | TypeScript | Clean TypeScript types for all responses |
| [SRM-Academia-Scrap-node](https://github.com/anuj-rishu/SRM-Academia-Scrap-node) | Express.js | Node.js reference with all endpoint signatures |
