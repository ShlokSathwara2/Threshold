# Threshold — Roadmap
*(SRM Academia companion app)*

**Stack:** Next.js (frontend, Vercel) + Go or Python scraper-backend (Render/Fly.io free tier) + Framer Motion / Lenis / Embla for UI feel. No paid services anywhere in this plan.

---

## Phase 0 — Recon & Setup
**Goal:** Understand exactly how Academia's login/data endpoints work before writing a line of app code.
- Log into academia.srmist.edu.in with DevTools Network tab open; capture the login POST, session cookies, and the requests each page (attendance, marks, timetable, calendar) makes.
- Cross-check your findings against goscraper and vcademia-api source to confirm/fill gaps.
- Set up: GitHub repo, Vercel account, Render/Fly.io account (all free tier), Node + Go/Python locally.
- **Deliverable:** A written note (even a text file) mapping every endpoint you'll need: URL, method, headers, payload shape, response shape.

## Phase 1 — Scraper Backend (core data engine)
**Goal:** A backend that, given a student's NetID+password, returns clean JSON for attendance/marks/timetable/calendar/profile — and never stores the password.
- Build `/login` (takes credentials, returns short-lived session token — password discarded immediately after use).
- Build `/attendance`, `/marks`, `/timetable`, `/calendar`, `/profile` endpoints, each taking the session token.
- Parse whatever Academia returns (HTML or JSON) into a consistent schema you control.
- Deploy to Render/Fly.io free tier.
- **Deliverable:** You can `curl` your own backend with your own credentials and get back real attendance/marks/timetable data.

## Phase 1.5 — Student Portal (Fallback + Extra Data)
**Goal:** Second data source from `sp.srmist.edu.in` — works when Academia is down, has data Academia doesn't (internal marks, SGPA/CGPA, exam results).
- Reverse-engineer Student Portal login flow (JSP + CAPTCHA auto-solve + honeypot + fingerprinting).
- Build parallel scraper: login, attendance, grades, internal marks, credits.
- CAPTCHA auto-solvable (answer embedded in `SECURE_CONFIG` in HTML).
- Wire as fallback: if Academia fails (403/timeout), try Student Portal automatically.
- Timetable remains Academia-only (not available on Student Portal) — cache after first fetch.
- **Deliverable:** Two working backends for attendance/marks — Academia + Student Portal, with auto-fallback.

## Phase 2 — Welcome, Onboarding & App Auth Layer
**Goal:** First-run experience before the login flow, then wire the frontend to the backend's login flow, safely, per-student.
- Welcome/onboarding screen(s): shown on first launch (or when logged out) — brief intro to what the app does, before the student ever sees a login form. Sets the visual tone (glass system) from the very first screen.
- Login screen → calls your backend's `/login` → stores only the session token client-side (not the password).
- Auto-logout on token expiry, re-prompt login.
- "Switch account" support from the start (matches your screenshots) since multiple students may use the same device.
- **Deliverable:** Welcome screen → login screen → working authentication against real Academia, landing on an empty dashboard shell.

## Phase 3 — Attendance Module (your #1 priority feature)
**Goal:** Per-subject attendance with the bunk/required-classes calculator.
- List all subjects: Present / Absent / Total / %.
- Margin calculator:
  - If ≥75%: how many classes can be skipped and stay ≥75%.
  - If <75%: how many consecutive classes must be attended to reach 75%.
- Overall attendance % across all subjects.
- "Danger zone" sort — lowest-margin subjects surfaced first.
- **Deliverable:** Fully working attendance screen with correct math, matching your screenshot layout (P/A/T pills, margin, progress bar).

## Phase 4 — Marks & CGPA/SGPA
**Goal:** Marks display + grade-target calculator + CGPA tool.
- Per-subject marks chart (test-wise, like your screenshots' line/point chart). Each subject starts at 0/0 (scored/total) before any internal is entered; as each test/component is fetched from the portal, both scored and total update live — the running total naturally builds up as marks get added.
- **Scheme auto-detection from real data**: instead of guessing 60-internal vs fully-internal from the course-type tag alone, use the actual fetched total — if a subject's cumulative total exceeds 60, the app knows it's on the fully-internal/100 scheme and switches the grade-target calculator accordingly, no manual flag needed. Course-type tag (Theory/Lab-Based/Project-Based) stays as a fallback signal before any marks are fetched.
- Grade-target calculator: port your GradeX logic in-app — enter internal marks, instantly see minimum required exam score for every grade band (O/A+/A/B+/B/C), live, no compiling needed. Grade table (applies to total/100 in every case):
  | Total Score | Grade | CGPA |
  |---|---|---|
  | ≥91 | O | 10 |
  | 81–90.99 | A+ | 9 |
  | 71–80.99 | A | 8 |
  | 61–70.99 | B+ | 7 |
  | 51–60.99 | B | 6 |
  | 41–50.99 | C | 5 |
  | <41 | Fail | — |
  - Subject scheme varies — calculator must be per-subject, not one fixed formula:
    - **Internal + end-sem (60/40 style)**: back-calculate required end-sem marks from entered internal marks, as in GradeX.
    - **Fully internal (100% internal, no end-sem)**: no back-calculation needed — just show current standing directly against the grade table as internal components are entered.
  - Scheme is detected automatically per the live-total logic above, not hardcoded per subject.
- CGPA calculator: manual credits + grade entry per subject, computed SGPA, undo/reset (matches your screenshots). Subject list must be fully editable — add a new subject row on demand (for subjects outside the auto-pulled registry, e.g. backlogs/electives not in the current semester), and delete any subject row, with SGPA recalculating live on every add/delete/edit.
- **Credit-weight visualization**: make the credit-weighting of SGPA visible, not just correct in the math — e.g. show each subject's grade-point contribution (credits × grade point) alongside its raw grade, so a drop in a 4-credit subject visibly moves SGPA more than the same grade drop in a 3-credit subject. A small "impact" indicator per subject (or a what-if toggle showing SGPA recompute live if you change one grade) makes the credit-weighting intuitive instead of hidden inside a formula.
- **Deliverable:** Marks screen + CGPA calculator screen + live grade-target tool, all functional with real or manually entered data.

## Phase 5 — Timetable
**Goal:** Day-order-aware, hour-wise timetable grid.
- Fetch/parse timetable data per student.
- Render as a day-order grid (Day 1–5, hour slots), matching the schedule image you shared.
- Highlight current/next class based on real time.
- Optional-hour handling: Academia gives no signal for which slots are optional — this is entirely per-student and manual. Let the student toggle each hour "taking / not taking" themselves, once, during setup or anytime after; when marked not-taking, that hour is hidden from the timetable grid (and excluded from attendance-risk calculations in Phase 3/9, since it was never a real obligation for that student).
- **Deliverable:** Timetable screen showing the student's actual weekly grid, with optional hours correctly toggleable and excluded when opted out.

## Phase 6 — Planner / Calendar
**Goal:** Month view with holidays, day-orders, and days-left counter.
- Month navigation, holiday markers, "today" marker.
- **Day-order anchoring (manual, since Academia doesn't expose day-order at all)**: since the portal never shows day-order per date, the student sets a one-time anchor — "this Monday is Day-order X" — during onboarding/setup. From that anchor, the app auto-increments the day-order forward by one for each working day, cycling through the student's actual day-order sequence (Day 1–5, per your timetable screenshot).
- **Day-order cascade correction**: if a working day gets marked as a holiday (either because Academia's calendar didn't list it, or the student manually flags an unscheduled holiday), every subsequent day-order shifts forward by one from that point on. This recomputes automatically across the rest of the planner and timetable — the student just marks the holiday once, the ripple is handled by the app, not manually re-entered for every following day.
- Total days / holidays / days-left summary bar (matches your screenshot).
- **Deliverable:** Working planner screen with a manually-anchored, auto-advancing day-order sequence that correctly cascades when holidays are marked, even though Academia itself provides none of this.

## Phase 7 — Dashboard & Profile
**Goal:** Tie everything into the home screen — the quick-glance screen, not the deep-dive one.
- Overview ring (overall attendance %), current class card, today's classes list (from Timetable).
- Per-subject quick list: marks scored/total (live, per Phase 4) and attendance %/margin together, compact — this is the daily-check view, deeper charts live in Phase 7.6 instead.
- "Your Standings" (attendance %, marks summary).
- Alerts section (holiday reminders, below-75% warnings, upcoming exam dates once Phase 9's exam tracker exists).
- Profile: reg number, batch, alerts, switch account, logout.like 
- **Design rule**: if a piece of data needs a chart/trend/comparison to be useful, it belongs in Phase 7.6 (Analytics), not here — Dashboard stays scannable in a few seconds, matching how your existing screenshots already separate quick-glance (Dashboard) from deep-dive (Marks/CGPA) screens.
- **Deliverable:** Full dashboard matching your reference screenshots functionally, with attendance, live marks, and timetable as the clear priority.

## Phase 7.5 — Subject Metadata Layer
**Goal:** Every subject card, anywhere in the app, shows its full identity at a glance — not just attendance/marks numbers in isolation.
- Standard subject metadata to surface consistently across Dashboard, Attendance, Marks, Timetable, and Planner: subject code, subject name, category (Professional Core / Elective / Basic Science / Foundation Course / Project Course / Mandatory, etc.), credits, slot (A/B/C.../L51-L52 style), faculty name + faculty ID, and course type (Theory / Lab Based Theory / Project Based Theory — also drives the Phase 4 grading scheme).
- Pull this once as a single "subject registry" from the scraper (likely from the course details/timetable endpoint) rather than re-fetching per screen — every other module (attendance, marks, CGPA, timetable) references this registry by subject code instead of duplicating the data.
- **Deliverable:** A single source-of-truth subject list per student, with every field from your screenshots (code, category, credits, slot, faculty+ID) available to any screen that needs it.

## Phase 7.6 — Summary & Analytics
**Goal:** The deep-dive screen — where Dashboard shows "what's true right now," Analytics shows "what's the pattern over time." Kept as its own section so Dashboard doesn't get overloaded (see Phase 7's design rule).
- **Overall trend charts**: attendance % over time (semester-to-date) and marks/SGPA trend across tests, both as line charts.
- **Subject-wise comparison view**: bar chart comparing attendance % across all subjects side by side, and a separate one for current marks standing per subject — makes weak spots visually obvious at a glance.
- **Combined risk table**: one table row per subject showing attendance %, margin, current marks, and (once Phase 9's exam-readiness score exists) the risk tag together — the single screen a student checks before deciding whether to skip anything.
- **Category/credit breakdown**: how credits are distributed across Professional Core/Elective/Basic Science/etc. (pulls from the Phase 7.5 subject registry) — mostly a nice-to-have pie/donut view.
- Reuses data already fetched by Phases 3, 4, and 7.5 — no new scraping, purely a visualization layer on top.
- **Deliverable:** A single Analytics screen combining attendance and marks visuals across all subjects, built after their individual screens exist so it has real data to chart.

## Phase 8 — Premium UI/UX Pass
**Goal:** Apply the glass system, motion, and texture across every screen built so far.
- Establish one glass design system: blur values, border/glow tokens, dark palette — apply consistently, don't reinvent per screen.
- Framer Motion: page transitions, card expand/collapse, tap/hover micro-interactions.
- Lenis: smooth scroll feel across long lists (attendance, marks).
- Embla: touch-swipe carousels/sliders where relevant (e.g. subject cards, month picker).
- Subtle noise/grain texture overlay on dark glass panels.
- **Theme settings tab**: a Settings screen with 5 selectable themes — light mode, the current dark-glass mode, and at least 3 more distinct looks (e.g. a high-contrast/OLED-black variant, a warm/amber accent variant, a neon-glow variant) — each swapping the color tokens/accent palette established above, not just inverting light/dark. Theme choice persists locally per device.
- **Notification settings**: a master on/off toggle in Settings — when off, no notifications fire, full stop. Underneath it, per-category toggles (attendance-risk alerts, exam-date reminders, holiday alerts) so a student can silence just one category without losing the rest. Preference persists locally per device.
- **Footer credit**: every screen (or at minimum Dashboard/Settings) shows "Made by Shlok Sathwara" in the footer, matching the attribution style already in your GradeX program.
- **Deliverable:** Every screen from Phases 3–7.6 upgraded to the premium look, with working theme switching and consistent footer attribution.

## Phase 8.5 — PWA & Mobile Installability
**Goal:** The app installs like a native app — "Add to Home Screen" / browser install prompt — with zero app-store cost or approval process, same approach as your Lecturn app.
- Mobile-first layout as the baseline for every screen (not adapted from desktop) — build for phone width first, since that's the primary usage context; desktop/tablet is a bonus, not the target.
- PWA manifest (app name, icons at required sizes, theme color, standalone display mode) so Chrome/Edge/Safari show a genuine "Install app" prompt.
- Service worker for offline shell caching (also directly supports Phase 10's offline resilience work).
- App icon set generated to match whichever theme is default (ties into Phase 8's theming work).
- Test the install flow specifically on Android Chrome (the "Add to Home Screen" banner) since that's most students' primary device, and iOS Safari's manual "Add to Home Screen" flow as a secondary path.
- **iOS/Android parity checklist** (these two platforms diverge more than people expect for PWAs):
  - iOS Safari has no automatic install banner — the student must manually tap Share → "Add to Home Screen." Design a clear in-app prompt walking them through this, since Android's automatic prompt won't appear on iOS.
  - Web push notifications only work on iOS 16.4+, and only after the app has been added to the home screen — Phase 9's notification features need a graceful fallback (in-app alerts) for iOS users who haven't installed yet or are on an older iOS version.
  - Safe-area insets: account for the notch/Dynamic Island (iOS) and gesture-nav bar (Android) in every screen's padding, not just the top bar — glass panels and the bottom nav bar (seen in your screenshots) are exactly the elements that clip awkwardly if this is skipped.
  - Test touch gestures (Embla sliders, drag interactions) against both platforms' native back-swipe/edge-gestures so they don't conflict.
- **Deliverable:** A student can visit the site once, tap "Install," and have the app on their home screen/app drawer like any other app — no Play Store listing needed — with confirmed smooth behavior on both iOS and Android.
## Phase 9 — Signature Differentiators
**Goal:** The features that make this app fundamentally different from ClassPro/AcademiaX/PortalX-style clones — not just a prettier data viewer, but a decision-support tool. Existing apps stop at "show me my data"; these interpret it.

**Build order within this phase (all of these ship — ordered by dependency and effort, not priority vs. optional):**
1. **Exam-readiness score**: combine attendance % + current internal marks + remaining test weightage into one per-subject risk indicator ("on track" / "at risk" / "critical"). Builds directly on Phase 3 (attendance) + Phase 4 (marks/grade calculator) data.
2. **Day-order + attendance fusion**: cross-reference Planner's day-order rotation with Attendance so the app can say "tomorrow is Day 3 — these are your at-risk subjects meeting that day."
3. **Offline resilience with "as of [time]"**: cache last-known state locally; on portal downtime, show cached data clearly timestamped instead of a blank/broken screen; diff what changed on reconnect.
4. **Leave-risk planner**: date-range picker — "leave from X to Y" — deterministically cross-references timetable + day-order + current attendance to show projected % after that leave, flagging anything that would drop below 75%.
5. **Exam date tracker**: manual entry of tentative exam dates per subject (read off the faculty handout once), surfaced as Dashboard alerts ahead of time.
6. **Change history**: local snapshots of attendance/marks over time so trends are visible ("attendance dropped 3% this week") — also what powers the time-travel slider below.
7. **Semester-end attendance forecast**: project where each subject's % lands by semester end given remaining working days and current attendance rate — not just today's margin.
8. **Optimal bunk planner**: if the student must skip classes on a specific day, recommend which subjects to skip to stay safest across all subjects simultaneously.
9. **Habit/pattern insights**: which day-of-week or subject is most often skipped, surfaced factually — information, not gamified guilt.
10. **Consequence-aware notifications**: instead of generic "class starting," push "skipping today drops Discrete Math to 74.2%" — routed through Phase 8's notification settings so it respects on/off + per-category toggles.
11. **Attendance heatmap calendar**: GitHub-contribution-style grid, one cell per class day, colored by present/absent/holiday.
12. **Time-travel slider**: scrub-bar over the change-history snapshots — drag through the semester and watch attendance %/marks evolve on the charts in real time.
13. **Semester Wrapped**: Spotify-Wrapped-style shareable card — best-attended subject, closest 75% call, CGPA trend, longest streak, total classes attended — exportable as an image. Highest viral potential here since every share is free promotion among classmates.
14. **Attendance streak counter**: "12 classes attended in a row" badge — reflects genuine behavior, not manipulative.
15. **Free-hour finder**: highlights literal free gaps in today's timetable (accounting for opted-out optional hours) and nudges toward using them ahead of an upcoming exam-tracker date.
16. **Attendance recovery plan generator**: given a current shortfall, generate a concrete plan — "attend the next 6 Computer Networks classes with zero misses to reach 75% by [date]" — turns the margin number into an actionable sequence instead of just a stat.
17. **Degree-long CGPA goal simulator**: "I want to graduate at X CGPA" → shows what SGPA is needed in each remaining semester to get there, recalculating as real semester results come in.
18. **"Today at a glance" morning brief**: one auto-generated summary each morning — today's classes, which of them are at-risk subjects, any exam-tracker date coming up soon.
19. **Universal search**: one search bar that jumps straight to a subject's attendance, marks, and timetable slot at once, instead of navigating three separate screens.
20. **Calendar export (.ics)**: export timetable and exam-tracker dates as a downloadable calendar file — syncs into Google Calendar/Apple Calendar/etc. with zero API cost, since .ics is just a static file format.
21. **Privacy transparency screen**: a plain-language "your password never touches our servers, here's exactly what we store and for how long" screen — trust as a visible feature, not just a backend implementation detail. Differentiates from clones that don't bother explaining this.
22. **Anonymous cohort benchmarking**: opt-in only, aggregated/anonymized — "your attendance is in the top 30% of your section." Build this last since it's the only one requiring more than one active user to be meaningful, and needs real care around consent and anonymization.
23. **Export attendance/marks as image or PDF.**
24. **"What-if" simulator**: mark hypothetical future attendance/marks and see recalculated %/CGPA live.
- **Deliverable:** All of the above shipped, roughly in this order — items 1–6 need no new UI paradigm and build directly on existing screens; 7–18 are the standout "wow" layer; 19–24 round out polish and trust.

## Phase 10 — Multi-Student Hardening
**Goal:** Make sure it's safe and stable for other students, not just you.
- Confirm no credentials are ever logged, cached, or persisted server-side beyond the active session.
- Rate-limit login attempts against Academia (protect both your backend and their account from lockouts).
- Basic error handling for Academia downtime/portal changes (graceful fallback, not a crash).
- Add a simple in-memory/short-TTL cache per session to avoid hammering Academia on every screen switch.
- **Deliverable:** App is safe to hand to a friend without you babysitting it.

## Phase 11 — Launch
**Goal:** Ship it.
- Deploy frontend (Vercel) + backend (Render/Fly.io), both free tier.
- Write a short privacy note for anyone else using it (what's stored, what isn't).
- Soft-launch to a few friends before wider club rollout.
- **Deliverable:** Live URL, ready to share.

---

### Suggested order of attack
Phase 0 → 1 → 1.5 (Student Portal fallback) → 2 (welcome + login) → 3 (get attendance fully working end-to-end first, since that's your priority) → then loop back for 4–7 → 7.5 (subject metadata registry — do this before or alongside Timetable/Marks so every screen can pull from it) → 7.6 (summary & analytics — needs 3/4/7.5's data to already exist) → 8 (polish) → 8.5 (PWA/installability) → 9 (all 24 signature differentiators, in the listed order) → 10 → 11.

All features across every phase now run on free-tier infrastructure only (no paid APIs, no LLM dependency) — everything is deterministic calculation over data you already scrape.
