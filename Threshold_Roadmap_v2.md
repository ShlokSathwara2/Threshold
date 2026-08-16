# Threshold — Roadmap (v2)
*(SRM Academia + Student Portal companion app)*

**Stack:** Next.js (frontend, Vercel + wrapped in Capacitor for Android) + Python/FastAPI scraper-backend (Render) + Framer Motion / Lenis / Embla for UI feel. No paid services required for the Android track; Apple Developer Program ($99/yr) only needed later if/when an iOS build is pursued.

**Status as of 2026-08-16:** Website track (Academia) is **paused** — attendance endpoint currently returns 403 and can't be validated end-to-end. Priority shifts to the **Android app track (Student Portal)**, which has a working, tested login path. Website resumes once the Academia 403 is root-caused.

---

## Phase 0 — Recon & Setup ✅ Done
*(unchanged)*

## Phase 1 — Academia Scraper Backend ⏸️ Paused
**Status:** Login flow works (session cookie established). Attendance endpoint currently returns `403 Page inaccessible` — root cause not yet found. Other endpoints (marks, timetable, calendar, profile) untested pending this fix.
- **Blocked deliverable:** attendance data via Academia. Resume debugging this once Android track is stable, or sooner if you want to context-switch back.

## Phase 1.5 — Student Portal Data Layer (App's Primary Source) 🔄 Revised
**Goal:** Second data source from `sp.srmist.edu.in` — now the **primary** source for the Android app, not just a fallback.

> **Correction from v1 of this roadmap:** the original plan called for reverse-engineering Student Portal's login (CAPTCHA auto-solve from leaked `SECURE_CONFIG.captchaText`, forged fingerprint/honeypot fields). This was fully tested and **disproven** — every automated variant (leaked captcha text, forged tokens, headless browser with `.fill()`, headless browser with real per-keystroke typing) was rejected by the server as `Invalid NetID or password`, while manual login in a real browser succeeds every time with identical credentials. The server-side anti-bot validation is real and effective. **Login is now handled via a native in-app WebView where the student logs in themselves** (Phase 1.6) — no credential/CAPTCHA automation involved anywhere in this flow.

- Data endpoint reference is still fully valid (confirmed via DevTools, `STUDENT_PORTAL_ENDPOINTS.md`) — these are normal authenticated POST requests once a real session cookie exists:
  - `studentAttendanceDetails.jsp` — attendance table
  - `studentAttendanceDetailsInner.jsp` — absent drill-down (needs `ids`, `attendanceMonth`, `attendanceYear`)
  - `studentMarksCredits.jsp` — grades, SGPA, CGPA, credit summary
  - `studentInternalMarkDetails.jsp` — internal marks
  - `studentInternalMarkDetailsInner.jsp` — internal mark component drill-down (needs `hdnSubjectId`, `status`)
- Build parsers (BeautifulSoup, same approach as Academia) for each endpoint above.
- **Critical: normalize output to the same schema Phase 1 already defined for Academia.** This is what makes "full app wrapped as-is" (per your Q2 answer) work cleanly — Phase 3+ UI doesn't need to know or care which portal the data came from.
- Known gap: Student Portal has no timetable endpoint. Until Academia is fixed, timetable-dependent features (Phase 9 item 2: day-order fusion, item 15: free-hour finder) are blocked for Android-only users — flag this clearly in-app rather than silently breaking.
- **Deliverable:** Given a valid Student Portal session cookie, backend returns attendance/marks/internal-marks/credits in the same schema Phase 3+ expects.

## Phase 1.6 — Android App Shell (Capacitor) 🆕 New, current focus
**Goal:** Wrap the existing Next.js app as an installable Android app, with native login via Student Portal.
- Add Capacitor (`@capacitor/core`, `@capacitor/android`, `@capacitor/cli`) to the existing Next.js project, remote-server mode pointing at the live Vercel deployment — reuses every screen already built, per your answer to Q2.
- Install an in-app-browser plugin with native cookie access (`@capgo/capacitor-inappbrowser` or Capawesome's equivalent) — required because Student Portal's session cookie is expected to be `HttpOnly`, which ordinary JS (`document.cookie`) can't read but native cookie-store APIs can.
- Login flow: tap "Log in" → native WebView opens the real Student Portal login page → student logs in themselves (real CAPTCHA, real form, zero automation) → app detects the post-login URL change → pulls cookies natively → closes WebView → stores session → routes to dashboard. No manual copy-paste.
- Platform detection (`Capacitor.isNativePlatform()`) so the same codebase shows the Student Portal native-login flow on Android and can show an Academia flow on web once that track resumes.
- Build and install: no Google Play listing needed for personal/friend use — build a debug/signed APK locally and sideload directly (`adb install` or just transferring the `.apk` file), since Android (unlike iOS) allows this without a developer account.
- **Deliverable:** An installable `.apk` that logs into Student Portal via native WebView and lands on a working dashboard with real attendance/marks data.

## Phase 2 — Welcome, Onboarding & App Auth Layer
**Goal:** Unchanged in spirit, scope narrowed to Android/Student Portal for now.
- Welcome/onboarding screens — unchanged.
- Login screen on Android uses the Phase 1.6 native WebView flow (not a credentials form).
- Web login screen (credentials → Academia) stays implemented but is not the active launch target until Phase 1 unblocks.
- Auto-logout on token/cookie expiry, re-prompt login.
- "Switch account" support — unchanged.
- **Deliverable:** Welcome → native login → working dashboard shell, Android-first.

## Phase 3 — Attendance Module ⏸️→▶️ Resumes now, sourced from Student Portal
**Goal:** Unchanged feature scope (margin calculator, danger-zone sort, P/A/T pills) — now built and tested against Student Portal data via the Android app, since that's the provably-working source. No UI changes needed if Phase 1.5's schema normalization holds.
- **Deliverable:** Fully working attendance screen on the Android app, real data, correct math.

## Phase 4 — Marks & CGPA/SGPA
*(unchanged — Student Portal actually has an advantage here: SGPA/CGPA come pre-calculated from `studentMarksCredits.jsp`, so less client-side computation needed than originally planned for Academia-only data)*

## Phases 5–7.6 — (unchanged from v1)

## Phase 8 — Polish & Theming (unchanged)

## Phase 8.5 — PWA & Mobile Installability 🔄 Scope narrowed
**Goal:** Unchanged for eventual web/iOS use, but no longer the primary Android install path — Phase 1.6's native `.apk` supersedes "Add to Home Screen" for Android users specifically. Keep this phase for:
- Web users (once Academia track resumes).
- Potential future iOS support — iOS has no APK equivalent; would need either occasional Mac+Xcode access (7-day free-signing expiry) or a paid Apple Developer account ($99/yr) for TestFlight distribution. Not scoped for now — revisit if/when iOS demand shows up.

## Phase 9 — Signature Differentiators
*(unchanged, all 24 items — note items 2 and 15 depend on timetable data, currently Academia-only, so they're blocked for Android-only users until Phase 1 unblocks or Academia's timetable data gets ported to a cached/manual fallback)*

## Phase 10 — Multi-Student Hardening 🔄 Slightly expanded
*(unchanged items, plus:)*
- Once both sources are live: wire actual dual-source fallback logic (Academia primary on web, Student Portal primary on Android, with automatic cross-fallback if one source's requests start failing repeatedly) — this was the original long-term vision and still applies once Phase 1 unblocks.

## Phase 11 — Launch 🔄 Two-track
- **Android track (near-term):** Share the `.apk` directly with friends/club for sideload install. No Play Store review needed for this scale.
- **Website track (later):** Deploy web frontend once Academia's attendance bug is resolved and Phase 3 is re-validated against real Academia data.
- Privacy note covers both sources' data handling.

---

### Suggested order of attack (v2)
Phase 0 ✅ → Phase 1 ⏸️ (paused, revisit later) → **Phase 1.5 (Student Portal data parsers) → Phase 1.6 (Capacitor Android shell + native WebView login) → Phase 2 (Android auth) → Phase 3 (attendance, Android-first, resumes now)** → 4 → 5–7 → 7.5 → 7.6 → 8 → 8.5 (web/iOS scope only) → 9 (minus timetable-dependent items until Academia unblocks) → 10 → 11 (Android launch first, website launch once Phase 1 is fixed).

Website (Academia) track picks back up in parallel whenever you want to context-switch — nothing built for Android is wasted, since the frontend, schema, and every Phase 3+ feature are shared across both sources by design.
