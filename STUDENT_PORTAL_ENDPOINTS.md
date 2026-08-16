# SRM Student Portal — Endpoint Reference

> Reverse-engineered from live portal HTML + DevTools Network tab.
> Last verified: 2026-08-15

---

## Base URL

```
https://sp.srmist.edu.in/srmiststudentportal
```

The Student Portal is a **JSP-based SPA** (Single Page Application). Data pages are loaded via jQuery AJAX calls after the initial page load.

---

## Authentication Flow

### Step 1 — GET Login Page

```
GET https://sp.srmist.edu.in/srmiststudentportal/students/loginManager/youLogin.jsp
```

**Returns:** HTML page with embedded `SECURE_CONFIG` JavaScript object:

```javascript
window.SECURE_CONFIG = {
    hiddenDomain: 'c3Auc3JtaXN0LmVkdS5pbix...',
    nonce: 'ea650950-1129-4e16-af38-5df4d5d2146c'
};
window.SECURE_CONFIG.captchaText = 'ky7gVK';        // <-- AUTO-SOLVABLE CAPTCHA
window.SECURE_CONFIG.domainFieldName = 'dtoken_ee5f02';  // dynamic per load
window.SECURE_CONFIG.captchaFieldName = 'cptoken_ef798b'; // dynamic per load
window.SECURE_CONFIG.randomDelimiter = '9d6d';
```

**Key insight:** The CAPTCHA answer is embedded in `captchaText` — no OCR needed.

**Also parse from HTML:**
- `challengeId` from `<input id="challengeId" value="...">`
- `fpNonce` from `<input id="fpNonce" value="...">`
- Honeypot field name from `<input name="ph_XXXXXXXX">` (dynamic per load)

### Step 2 — POST Login

```
POST https://sp.srmist.edu.in/srmiststudentportal/LoginServlet
Content-Type: application/x-www-form-urlencoded
```

**Form fields:**

| Field | Value | Notes |
|-------|-------|-------|
| `username` | NetID (max 6 chars) | WITHOUT `@srmist.edu.in` |
| `password` | Student password | Email password |
| `captcha` | `captchaText` from SECURE_CONFIG | Auto-solved |
| `{honeypot_field}` | `""` (empty) | Dynamic field name `ph_XXXXXXXX` |
| `fpPayload` | `{}` or minimal JSON | Browser fingerprint (likely not validated) |
| `fpToken` | `""` | Fingerprint token |
| `challengeId` | UUID from hidden field | |
| `fpNonce` | UUID from hidden field | |

**Response:** 302 redirect to portal dashboard on success, or error page.

**Session established via cookies** (JSESSIONID + others).

---

## Data Endpoints

All data endpoints are loaded via **jQuery AJAX** from `HRDSystem.jsp`. The SPA makes XHR requests to JSP files that return HTML fragments.

### 1. Attendance

```
POST https://sp.srmist.edu.in/srmiststudentportal/students/report/studentAttendanceDetails.jsp
```

**Auth:** Session cookies

**Returns:** HTML table with course-wise attendance:

```html
<table>
  <thead>
    <tr>
      <th>Code</th>
      <th>Description</th>
      <th>Max. hours</th>
      <th>Att. hours</th>
      <th>Absent hours</th>
      <th>Total Percentage</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>21CSC301T</td>
      <td>FORMAL LANGUAGE AND AUTOMATA</td>
      <td>9</td>
      <td>9</td>
      <td>0</td>
      <td>100.00</td>
    </tr>
  </tbody>
</table>
```

### 2. Absent Details (drill-down)

```
POST https://sp.srmist.edu.in/srmiststudentportal/students/report/studentAttendanceDetailsInner.jsp
Content-Type: application/x-www-form-urlencoded
```

**Form fields:**

| Field | Value |
|-------|-------|
| `ids` | `1` |
| `attendanceMonth` | Month number |
| `attendanceYear` | Year |

**Returns:** HTML with detailed absent records for a specific month/year.

### 3. Grade / Mark & Credit

```
POST https://sp.srmist.edu.in/srmiststudentportal/students/report/studentMarksCredits.jsp
```

**Auth:** Session cookies

**Returns:** HTML table with semester-wise grades, SGPA, CGPA, and credit details:

```html
<table>
  <thead>
    <tr>
      <th>Semester</th>
      <th>Month / Year</th>
      <th>Code</th>
      <th>Description</th>
      <th>Credit</th>
      <th>Grade</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>DEC/2024</td>
      <td>21MAB101T</td>
      <td>CALCULUS AND LINEAR ALGEBRA</td>
      <td>4</td>
      <td>O</td>
    </tr>
    <!-- SGPA row per semester -->
    <tr>
      <td align="right" colspan="5"><b>SGPA</b></td>
      <td><b>9.364</b></td>
    </tr>
    <!-- CGPA row at end -->
    <tr>
      <td align="right" colspan="5"><b>CGPA</b></td>
      <td><b>9.44</b></td>
    </tr>
  </tbody>
</table>
```

**Also contains credit details:**
```html
<table>
  <tr><td>Credits Registered</td><td>92</td></tr>
  <tr><td>Credits Earned</td><td>92</td></tr>
  <tr><td>Credits Required</td><td>163</td></tr>
</table>
```

### 4. Internal Mark Details

```
POST https://sp.srmist.edu.in/srmiststudentportal/students/report/studentInternalMarkDetails.jsp
```

**Auth:** Session cookies

**Returns:** HTML table with internal marks:

```html
<table>
  <thead>
    <tr>
      <th>Code</th>
      <th>Description</th>
      <th>Mark / Max. Mark</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>21CSC301T</td>
      <td>FORMAL LANGUAGE AND AUTOMATA</td>
      <td>45/50</td>
    </tr>
  </tbody>
</table>
```

### 5. Internal Mark Component Details (drill-down)

```
POST https://sp.srmist.edu.in/srmiststudentportal/students/report/studentInternalMarkDetailsInner.jsp
Content-Type: application/x-www-form-urlencoded
```

**Form fields:**

| Field | Value |
|-------|-------|
| `iden` | `1` |
| `hdnSubjectId` | Subject ID |
| `status` | Status value |

**Returns:** HTML with component-wise marks for a specific subject.

---

### 5. Academic Calender/Planner — **day orders** (VERIFIED 2026-08-17)

```
POST https://sp.srmist.edu.in/srmiststudentportal/students/report/AcademicCalenderDetails.jsp
```

**Auth:** Session cookies. Returns the page shell with a Template `<select id="selTemplate">`:

```html
<option value="1" data-fromdate="21-07-2026" data-todate="07-12-2026">FET Template</option>
<option value="3" data-fromdate="21-07-2026" data-todate="20-12-2026">SAID Template</option>
```

Also has `<input id="hdnCurrentAcademicYearId" value="26">` (academic year id).

**Step 2 — fetch the actual calendar:**

```
POST https://sp.srmist.edu.in/srmiststudentportal/students/report/AcademicCalenderDetailsInner.jsp
```

**Form fields:**

| Field | Value |
|-------|-------|
| `hdnCurrentAcademicYearId` | `26` |
| `selTemplate` | `1` (FET) |
| `hdnDayOrderTemplateId` | `1` |
| `hdnFromDate` | `21-07-2026` |
| `hdnToDate` | `07-12-2026` |
| `ids` | `1` |
| `filter` | `""` |

**Returns:** HTML with stats row + table:
```
94 No. of Working days  46 No. of Holidays  140 Total days
```

| Column | Content |
|--------|---------|
| DATE | `21-07-2026` (dd-mm-yyyy) |
| DAY | `Tuesday` |
| STATUS | Working day / Holiday (`.ac-badge-work` / `.ac-badge-hol`) |
| WEEK | `Wk 1` (`.ac-week-chip`; `Wk 0` on holidays) |
| DAY ORDER | `Day 1` .. `Day 5` (`.ac-day-chip`; empty on holidays) |
| REMARKS | Holiday name (`Milad-un-nabi`, `Vinayagar Chathurthi`...) or `-` |

**Row structure:** `<tr class="ac-tr"><td class="ac-td" data-date="...">...` — each row has 6 `td`s.

> **This is the ONLY source with explicit day orders** — academia's planner has none. The day-order sequence (Day 1–5 cycling per working day, holidays skipping to `Wk 0`) drives the timetable's DO labels.

**Frontend mapping:** dayOrder string built as `"Wk {n} · Day {d} · Working day"`, event = remarks (or status). Frontend shows `DO-{d}` chip per working day.

---

### 6. Student Profile — full details (VERIFIED 2026-08-17)

```
POST https://sp.srmist.edu.in/srmiststudentportal/students/report/studentProfile.jsp
```

**Auth:** Session cookies

**Returns:** HTML with a label/value table (12 rows). Labels → parsed fields:

| Label | Field key |
|-------|-----------|
| Student Name | `name` |
| Student ID | `student_id` |
| Register No. | `reg_number` |
| Email ID | `email` |
| Institution | `institution` |
| Program | `program` |
| Semester | `semester` |
| Batch | `batch` (⚠️ usually EMPTY here — comes from academia `/user`) |
| Section | `section` (⚠️ usually EMPTY here — comes from academia `/user`) |
| Faculty Advisor | `faculty_advisor` |
| Academic Advisor | `academic_advisor` |

**Photo:** the student photo lives on the SPA dashboard (`HRDSystem.jsp`) — `fetch_profile` also hits that page and extracts the `<img>` (base64 data URI in response).

**Backend:** `data.py::_extract_dashboard_fields(soup)` parses `tr > td,th` label→value rows; `fetch_profile` fetches `studentProfile.jsp` + grades page (semester fallback) + HRDSystem.jsp (photo).

---

### 7. SPA menu navigation (formId → page mapping)

The SP portal is a JSP SPA. `UserHomePage.jsp` renders the menu; each item calls `funSetFormId(N)` which submits hidden form field `hdnFormId=N` to `HRDSystem.jsp`, which then loads the report JSP via `funShow(id, argURL)` → `$.post(argURL, {iden, filter, hdnFormDetails, csrfPreventionSalt})`.

Known formIds (from user's menu): 8=Grade/Mark&Credit, 84=Course Status, **129=Academic Calender/Planner**, 142=Student Course Registration. The inner JSP URL for each is embedded in the page HTML as `funShow(129, "../../students/report/AcademicCalenderDetails.jsp")`.

**In practice, you don't need the SPA dance** — POST the report JSP directly with session cookies (as all fetchers above do). `_init_session` (POST to `HRDSystem.jsp`) initializes the session.

---

## Grade Scale

| Grade | Min % | Max % | Result |
|-------|-------|-------|--------|
| O | 91.00 | 100.00 | PASS |
| A+ | 81.00 | 90.00 | PASS |
| A | 71.00 | 80.00 | PASS |
| B+ | 61.00 | 70.00 | PASS |
| B | 56.00 | 60.00 | PASS |
| C | 50.00 | 55.00 | PASS |
| Ab | 0.00 | 100.00 | INCOMPLETE |
| * | 0.00 | 100.00 | WITHHELD |
| I | 0.00 | 100.00 | FAIL |
| W | 0.00 | 100.00 | FAIL |
| F | 0.00 | 49.00 | FAIL |

---

## Session Management

- Session is cookie-based (JSESSIONID + other cookies)
- No explicit expiry observed — dies on server-side timeout or logout
- Must store only the cookie string client-side, never the password
- Re-login required when session expires

---

## Comparison with Academia

| Feature | Academia | Student Portal |
|---------|----------|----------------|
| Attendance | ✅ (page currently 403 — renamed) | ✅ (cleaner HTML) |
| Marks/Grades | ✅ | ✅ (with SGPA/CGPA pre-calculated) |
| Internal Marks | ❌ (manual lookup) | ✅ (dedicated page; currently "No Record found" — not uploaded yet) |
| Timetable | ✅ (derived from courses + unified grid) | ❌ |
| Calendar | ✅ (planner, no day orders) | ✅ (planner WITH day orders — the source we use) |
| Day Orders | ❌ | ✅ (AcademicCalenderDetailsInner.jsp) |
| Courses | ✅ | ✅ |
| User Profile | ✅ (batch/section) | ✅ (name/id/email/advisors — richer) |
| Exam Results | ❌ | ✅ |
| Credits | ❌ | ✅ (Registered/Earned/Required) |
| CAPTCHA | Optional (sometimes triggered) | Always required (but auto-solvable) |
| Login Complexity | Multi-step redirect | Single POST |
| Auth Platform | Zoho Creator | JSP/Java |

**Data-source decisions (as of 2026-08-17):**
- **Timetable** → Academia (`Unified_Time_Table_2025_Batch_{N}` grid + `My_Time_Table_2023_24` courses)
- **Calendar** → Student Portal (`AcademicCalenderDetailsInner.jsp` — only source with day orders)
- **Attendance** → SP is more reliable (academia's `My_Attendance` currently 403)
- **Profile** → SP (`studentProfile.jsp`), batch/section fallback to academia `/user`
- **Batch** → academia `/user` (course page); SP shows it empty

---

## Key Technical Notes

1. **CAPTCHA is always required** but auto-solvable from `SECURE_CONFIG.captchaText`
2. **Honeypot field name changes per page load** — must parse from HTML, never hardcode
3. **Fingerprint fields** (`fpPayload`, `fpToken`) are JS-generated but likely not strictly validated server-side — minimal/empty values work
4. **All data pages return HTML** — same parsing approach as Academia (BeautifulSoup)
5. **The SPA loads data via jQuery AJAX** — `$.post()` and `$.get()` calls to JSP files
6. **Timetable is NOT available** on Student Portal — must use Academia for timetable
