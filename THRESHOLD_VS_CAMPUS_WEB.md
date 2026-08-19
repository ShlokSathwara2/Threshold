# Threshold vs The Campus Web — Why We're Better

> Feature-by-feature comparison against campusweb.in / Campus App (com.campusweb.campusapp).
> Last verified: 2026-08-19

---

## 1. Data sources

| Capability | Threshold | Campus Web |
|---|---|---|
| Student Portal (sp.srmist.edu.in) | ✅ full suite | ✅ basic suite |
| Academia (academics.srmist.edu.in) | ✅ full (marks, attendance, grades) | ❌ none |
| Attendance + per-subject history | ✅ + absent-date detail per month | ❌ only current % snapshot |
| Timetable | ✅ + **day-order aware** (today's day computed) | ✅ raw day tabs only |
| Internal marks breakdown | ✅ per-component (CAT1/2, theory/practical) | ❌ aggregated only |
| Marks / CGPA | ✅ grades + credits + **CGPA calculator** | ⚠️ marks total only (CGPA calc page exists, data thin) |
| Exams | ✅ hall tickets, exam timetable, provisional results | ❌ none |
| Course status (credits earned/needed) | ✅ full credit audit | ❌ none |
| Personal details | ✅ full labelled profile dump | ❌ none |
| Events/clubs | ✅ (fetchable) | ✅ carousel (ad-driven) |

---

## 2. Login & sessions

| Aspect | Threshold | Campus Web |
|---|---|---|
| SP login | ✅ server-side, **CAPTCHA auto-solved** (SECURE_CONFIG leak) — user never types one | server-side, user sees whatever their proxy does |
| Academia login | ✅ HIP captcha flow + concurrent-session auto-terminate + retry | ❌ not supported |
| Session storage | per-login identity (reg number) scoped keys | single `X-CSRF-Token` cookie |
| Token handling | cookie string only ever sent to our backend (client is dumb terminal) | same idea, but token accepted verbatim with zero rotation |
| Multiple logins on one device | ✅ fully isolated per student | ❌ one cookie for everyone |
| Offline re-login | ✅ cached data survives session expiry | ❌ token expiry = full logout + refetch |

---

## 3. The app itself

| Aspect | Threshold | Campus Web |
|---|---|---|
| Offline-first | ✅ all data cached locally, app usable with no network | ⚠️ depends on live API; falls back to localStorage snapshots only |
| Per-login localStorage | ✅ every feature scoped by user hash | ❌ global `studentData` / `studentTimetable` keys |
| Optional hours (OPT) | ✅ hide/show user-opted classes | ❌ no concept |
| Leave planner | ✅ "assume attendance till leave, then project" — shows % impact per subject | ❌ none |
| Attendance forecasting | ✅ projected % after N leaves, per-subject drop-below-75 flags | ❌ none |
| Habits / skip tracking | ✅ habit streaks + skip log + insights | ❌ none |
| Notifications | ✅ local notifications (per-login prefs) | ⚠️ web push only |
| App lock | ✅ biometric + device PIN (Capacitor, device-level) | ❌ none |
| Theming | ✅ multiple custom themes, glass/glow effects | fixed dark theme |
| Animated UI | ✅ framer-motion + custom effects (portal rift, liquid metal...) | basic Tailwind |
| Pull-to-refresh, smooth scroll | ✅ | ❌ |

---

## 4. Engineering quality

| Aspect | Threshold | Campus Web |
|---|---|---|
| Backend endpoints | documented (`STUDENT_PORTAL_ENDPOINTS.md`, `ACADEMIA_ENDPOINTS.md`) | undocumented |
| Failover | real backend retry logic | fake — 10 constants, same URL |
| Security posture | session only used against our own API; per-user scoping | raw SP cookies accepted on every endpoint |
| Caching strategy | per-login, per-feature, with migration for legacy keys | global keys, cleared wholesale |
| Rate limiting | handled per-endpoint with graceful degradation | toast + no backoff |
| Docs | 5+ reference/roadmap docs in repo | none |

---

## 5. Gaps where Campus Web is ahead (honest list)

1. **PWA + App Store presence** — they ship a real iOS app (`id6760725730`) and a Play app; we're Android-only right now.
2. **Course feedback system** (`/api/auth/feedback`) — they let students fill SRM's mandatory feedback from the app. We don't.
3. **Club ecosystem** — club organiser login, events carousel, WhatsApp community links. We don't have a clubs/events surface.
4. **Sponsor/ad monetisation** — they run sponsored banners; we have none (fine for now).

---

## Bottom line

- Threshold already **supersets** Campus Web on student data: academia, exams,
  internal marks, course status, personal details, forecasting tools.
- The only real missing surface is **iOS + PWA delivery** and the **feedback/clubs
  features** — both are frontend work on top of the same backend we already run.

---

## Action items

- [ ] Deploy static web build (`frontend/out`) for iOS Safari users (PWA manifest, WebAuthn app lock)
- [ ] Consider course-feedback endpoint on our backend (mirror SP flow)
- [ ] Optional: events/clubs feed in our dashboard