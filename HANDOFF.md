# Threshold — Session Handoff Prompt

You are continuing work on **Threshold**, an SRM (SRM Institute of Science and Technology) student companion app. Read this entire document before doing anything.

## Project Overview
- **Frontend:** Next.js 16.3.1 (Turbopack) + TypeScript + Tailwind, at `D:\Threshold\frontend\` — deployed to Vercel: https://threshold-jet.vercel.app
- **Backend:** Python FastAPI at `D:\Threshold\backend\` — deployed to Render: https://threshold-1-ly01.onrender.com (healthy, verified 200)
- **Mobile:** Capacitor 8 Android app (appId `com.threshold.app`), built locally with Gradle — NO Android Studio needed
- **GitHub:** https://github.com/ShlokSathwara2/Threshold (last commit `df4b57c`)
- **Roadmap:** `D:\Threshold\Threshold_Roadmap_v2.md` — current phase 1.6: Android APK with native in-app WebView login to SRM Student Portal, capture session cookies, fetch student data via backend
- **Environment (Windows, PowerShell 5.1):** JDK 24 (`JAVA_HOME=C:\Program Files\Java\jdk-24`), Android SDK at `%LOCALAPPDATA%\Android\Sdk` (build-tools 35.0.0), Gradle 8.14.3 wrapper. Phone: Galaxy S25 Ultra SM-S938B, USB debugging connected (`adb` device `R5CYA12VL5K`), `adb` at `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`

## The Login Flow (Current Goal)
- Login page: `frontend\src\app\login\page.tsx` — `handleNativeLogin()` opens `SP_LOGIN_URL` (`https://sp.srmist.edu.in/srmiststudentportal/students/loginManager/youLogin.jsp`) in an InAppBrowser WebView (`@capgo/capacitor-inappbrowser`), with a desktop Chrome UA (`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36`) and `captureConsoleLogs: true`
- On `urlChangeEvent` hitting `HRDSystem`/`template` → `InAppBrowser.getCookies(...)` → `storeSession()` → `/dashboard`
- Web fallback (works today): user pastes session cookie manually
- Login form posts to `/srmiststudentportal/LoginServlet` (fields: `username`, `password`, `captcha`, `fpPayload`, `fpToken`, `recaptchaToken`)
- Forgot-password is on a **different host** `ssp.srmist.edu.in` — no WAF there, its captcha renders fine in the WebView (irrelevant to login, but proves the 403 is host/endpoint-specific)

## CAPTCHA Mechanism (decoded from guardlogin.js)
On DOMContentLoaded the page XHR-GETs `https://sp.srmist.edu.in/srmiststudentportal/SCaptchaServlet?ts=<ms>&token=<uuid>` with header `X-Domain-Proof: btoa(SECURE_CONFIG.nonce + ":" + location.hostname)`, `responseType='blob'`, then sets `img.src = URL.createObjectURL(...)`. The captcha image is the thing that never renders in the app (broken-image icon; console shows `403`).

## Root Cause (proven with evidence — DO NOT re-litigate without new data)
The site is behind an **F5/Imperva anti-bot WAF** (Apache 2.4.58 front, `TS9dec798a027` challenge cookie, Tomcat 9.0.8 error pages):

1. **`X-Requested-With: com.threshold.app` is the primary 403 trigger** on `SCaptchaServlet` — proven by differential curl tests (clean headers → 200 image/png; +X-Requested-With → 403; `sec-ch-ua` values alone → 200). Android WebView injects this header natively; page JS cannot remove it.
2. **The WAF challenges sessions at page load.** On the phone, a fresh page load produces a TS challenge cookie (rotated on every 403). Challenged sessions get 403 on the captcha **even with all fingerprint headers stripped**. On a clean PC IP, the same page load sets NO TS cookie and the captcha returns 200 with identical headers.
3. **Only the captcha path is protected:** fonts, images, and the login POST (`LoginServlet`, tested 200 with XRW) all pass from the phone.
4. What still differs phone-vs-PC: mobile-data IP reputation or Android `HttpURLConnection`/Conscrypt TLS fingerprint (JA3). Both are HTTP/1.1. Page JS runs in the WebView; the challenge is NOT a JS challenge in the 403 body (plain Tomcat error page).

## Fixes Implemented (all local; compiled into APK — nothing pushed, backend untouched)
1. **Patched plugin source** `frontend\node_modules\@capgo\capacitor-inappbrowser\android\src\main\java\ee\forgr\capacitor_inappbrowser\WebViewDialog.java`:
   - `shouldInterceptRequest` (line ~5670) now calls `interceptFingerprintFreeRequest()` for **all GETs to host `sp.srmist.edu.in`** (page load, captcha, subresources): replays via `HttpURLConnection`, stripping `X-Requested-With`, `sec-ch-ua`, `sec-ch-ua-mobile`, `sec-ch-ua-platform`, `Accept-Encoding`; forwards page headers + cookies from `CookieManager` + desktop UA (`resolveWebViewUserAgent()`); returns `WebResourceResponse` with parsed mime/charset; persists 2xx `Set-Cookie` into `CookieManager`; non-2xx → `null` (native fallback)
   - **CRITICAL THREADING RULE:** `shouldInterceptRequest` runs on a background thread — NEVER call `_webView.*` methods there (crashes with `RuntimeException: A WebView method was called on thread 'ThreadPoolForeg'`). Use `resolveWebViewUserAgent()`
   - Logs under tag `InAppBrowserCaptcha` (`adb logcat -s InAppBrowserCaptcha:I`)
2. **Preserved copy** of the patched file at `frontend\patches\WebViewDialog.java` — `npm install` wipes node_modules; re-copy it after any install/sync before rebuilding
3. `login/page.tsx`: `await CapacitorCookies.clearAllCookies()` before `openWebView` (fresh session each attempt)
4. `frontend\android\app\src\main\java\com\threshold\app\MainActivity.java`: `WebView.setWebContentsDebuggingEnabled(true)` for chrome://inspect
5. `network_security_config.xml` (cleartext) added to manifest earlier — not related to this bug

## Build & Install Commands (Windows PowerShell)
```powershell
# rebuild web assets
cd D:\Threshold\frontend
$env:CAPACITOR_BUILD="true"; npx next build
npx cap sync android
# rebuild APK (plugin Java changes compile in from node_modules)
cd D:\Threshold\frontend\android
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"; .\gradlew.bat assembleDebug
# install + logs
$adb="$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb install -r "D:\Threshold\frontend\android\app\build\outputs\apk\debug\app-debug.apk"
& $adb logcat -c
& $adb logcat -s InAppBrowserCaptcha:I
```

## Campus Web Attendance Bug — FIXED (2026-09-02)
**Problem:** Attendance showed 0% for all subjects when logged in via Campus Web (web browser, not APK).

**Root cause:** Field name mismatch in `fetchCampusWebStudentPortalAttendance()` (`frontend/src/lib/api.ts:931-940`). The Campus Web API endpoint `/api/student-portal/attendance` (proxied via `campusapi.fly.dev`) returns:
```
subjectcode, subjectdesc, present, absent, total, presentpercentage
```
But the adapter was mapping from field names that don't exist in this response:
```
courseCode, courseTitle, hoursConducted, hoursAbsent, attendancePercentage
```
All values defaulted to `0` → `calculateSubjectAttendance()` computed `0/0 = 0%`.

**Fix:** Added the actual Campus Web API field names as `||` fallbacks in the mapping chains:
- `a.subjectcode` → `courseCode`
- `a.subjectdesc` → `courseTitle`
- `a.total` → `hoursConducted`
- `a.presentpercentage` → `attendancePercentage`

**Verified:** Tested with credentials `ss1516` / `kolhS#24` — all 9 subjects now return correct percentages (100%, 83.33%, 77.78%, etc.). Commit `df4b57c`, pushed to `main`, Vercel auto-deploys.

**Campus Web API details (for future reference):**
- Login: `POST https://campusapi.fly.dev/api/auth/login/` with `{username: "ss1516@srmist.edu.in", password: "..."}` → returns `Cookies` field (use as `X-CSRF-Token` header)
- Also: `POST https://campusapi.fly.dev/api/student-portal/login` with `{net_id: "ss1516", password: "..."}` → returns `semester_id`
- Attendance: `POST https://campusapi.fly.dev/api/student-portal/attendance` with `{net_id: "ss1516"}` + cookies → returns `{attendance: [...], net_id, status}`
- User data: `GET https://campusapi.fly.dev/api/auth/user/` with cookies → returns courses, testPerformances, profile
- All proxied through `frontend/src/app/api/campus-proxy/route.ts` (Next.js API route) and `frontend/src/app/api/campus-login/route.ts`

## Current Status (what a fresh agent inherits)
- **Campus Web attendance is FIXED and deployed:** `fetchCampusWebStudentPortalAttendance()` now correctly maps Campus Web API field names. Verified with `ss1516` credentials — 9 subjects with correct percentages. See ## Campus Web Attendance Bug — FIXED section above.
- **The captcha/login battle is RESOLVED differently than planned:** the app now uses the phone's real Chrome via `@capgo/capacitor-inappbrowser` with desktop UA + cookie capture (`InAppBrowser.getCookies` → `storeSession()`). Do NOT re-open the WAF investigation; it was solved by the WebView login flow that is live and working.
- **Web login via curl (IN PROGRESS — NOT WORKING YET):** backend `curl_login.py` + frontend CAPTCHA flow exist but login POST always returns "Invalid credentials". See ## Web Login Status below.
- **Current feature state (all installed & verified on device):** swipe-to-start welcome, dashboard (bunk planner, habit insights, universal search, today-at-a-glance, sync-status caption), exams page with **cloud sync** (backend `GET/PUT /sp/exams` keyed by `X-User`, store at `backend/data/user_exams.json`), **delta sync** (`X-Delta-Hash` on `/sp/attendance|marks|internal-marks|calendar|profile` → `{"delta":"unchanged"}` short-circuit; client stores raw under `threshold_delta_raw__*`), **deep links** (`threshold://attendance|subject/{code}|timetable|marks|exams` — manifest intent-filter + `appUrlOpen` in dashboard layout), **App lock** (local Kotlin plugin `BiometricLockPlugin` — androidx.biometric fingerprint/face/PIN via DEVICE_CREDENTIAL; settings toggle `threshold_applock`; `AppLockGate` overlay in dashboard layout; re-locks on background), **local notifications** (`@capacitor/local-notifications@8.3.0` — morning brief 8 AM: at-risk <75% + exams ≤3 days; exam-day/tomorrow reminders 9 AM; gated by `notif` prefs; rescheduled from dashboard effect), hamburger sidebar name fix (avatar initial + prettified name) + staggered nav animations, settings Trust & security section, welcome features updated.
- **PENDING — backend deploy:** new endpoints exist only locally (`localhost:8000`). The device app points to Render (`https://threshold-1-ly01.onrender.com` per `.env.production`) — needs the backend committed + pushed + deployed for exam cloud sync / delta sync to activate. Until then both fail safe (404 → sync returns null, local data kept).
- **KNOWN PATCH (re-apply after `npm install`):** `node_modules\@capacitor\local-notifications\android\build.gradle` — removed `kotlin { jvmToolchain(21) }` (no JDK 21 on this machine), set `compileOptions` to `VERSION_17`, added `kotlin { compilerOptions { jvmTarget.set(JvmTarget.JVM_17) } }`. Without it `gradlew assembleDebug` fails with "Cannot find a Java installation matching languageVersion=21".
- `adb` device is `R5CYA12VL5K`; harmless console line `Uncaught TypeError: triggerEvent` at startup is pre-existing plugin-init noise (no crash; frames render fine).
- Working SP cookie (may expire): `JSESSIONID=93E5386750745A6204742F10DCF79147.worker3; TS9dec798a027=08de21a07dab2000e06e1af891dd67d9e7b24b554549f4408e41ed2bf231fb57c294005dc5b2241508a7de64f71130000c1691e8b64d7cc7e1abb82c085c8df8ae8eb765c22a7f6f5a749da2b52e2c555b9a0936b52c03b1ebd6293cb9df4c57`
- **Parked (user):** new logo file `Gemini_Generated_Image_vu5vngvu5vngvu5v.png` (1415×736) at repo root — user wants it cropped as app logo later (asked, then said "leave it for now").

## Web Login Status (IN PROGRESS — NOT WORKING)
**Goal:** Allow web users (browser, not APK) to log in with NetID + password + CAPTCHA, bypassing the WAF that blocks Python requests/httpx.

**What was built:**
1. `backend/scraper/student_portal/curl_login.py` — uses `curl.exe` (libcurl, different JA3 TLS fingerprint than Python) to bypass the WAF
   - `start_login(username)` → fetches login page + CAPTCHA image via curl.exe subprocess, returns base64 CAPTCHA
   - `finish_login(session_id, username, password, captcha)` → POSTs login form via curl.exe
   - Sessions stored in-memory dict `_sessions` with 300s TTL
2. `backend/web/routes.py` — new endpoints:
   - `POST /sp/curl-login-init` — calls `start_login()`, returns `{session_id, captcha_image_base64}`
   - `POST /sp/curl-login-verify` — calls `finish_login()`, returns `{success, cookies}`
   - `POST /sp/curl-refresh-captcha` — refreshes CAPTCHA for existing session
3. `frontend/src/app/login/page.tsx` — web-only CAPTCHA flow (inside `else` branch of `isNative` check)
4. `frontend/src/lib/api.ts` — added `campusWebLogin`, `campusWebAttendance` helpers + Campus Web interfaces

**Key findings that worked:**
- `curl.exe` (libcurl) bypasses the WAF — CAPTCHA fetch returns 200 OK (1000-1200 bytes PNG)
- Python `subprocess.run()` with `-s` (silent) flag breaks JSESSIONID cookie saving — **must NOT use `-s`** in curl commands
- `X-Domain-Proof` header triggers WAF 403 — must NOT be sent
- The login page HTML contains `captchaText` in `SECURE_CONFIG` but this is for client-side SVG rendering, NOT the answer to the server-side CAPTCHA image

**What's broken (the blocker):**
- Login POST always returns "Invalid credentials" — even when using the `captchaText` from the page HTML (which should be correct)
- Tested: correct password `kolhS#24` (confirmed by user), various CAPTCHA texts, empty CAPTCHA — ALL return "Invalid credentials"
- The error is generic — "Invalid credentials" means wrong password OR wrong CAPTCHA, server doesn't distinguish
- **Likely root cause:** The `captchaText` embedded in `SECURE_CONFIG` is NOT what the server validates against. The `SCaptchaServlet` generates a separate CAPTCHA, and the server validates against THAT. The CAPTCHA images I've been reading may be misread, OR there's an additional hidden field / validation we're missing.
- **Additional hidden fields found in guardlogin.js:** On form submit, JS adds `domainFieldName` (e.g. `dtoken_xxx`) = `btoa(reversedHost)` and `captchaFieldName` (e.g. `cptoken_xxx`) = `btoa(timeElapsed)`. These ARE being sent.
- **Other missing pieces possibly:** `telemetryPayload` hidden field (from `secure2.js`), honeypot field `ph_0bbb620f` (being sent empty)
- **The `.env.local` fix:** Changed from `https://threshold-1-ly01.onrender.com` to `http://localhost:8000` but frontend may still show "failed to fetch" — the dev server may need a full restart (kill all node processes, wait, restart)

**What to try next:**
1. First fix the "failed to fetch" — ensure frontend dev server is running and `.env.local` points to `http://localhost:8000`
2. Use Chrome DevTools Protocol (port forwarding already set up: `tcp:9223` → `localabstract:chrome_devtools_remote`) to intercept a REAL browser login POST to `LoginServlet` — capture the exact form fields and values the browser sends
3. Compare with what `curl_login.py` sends — find the missing field or encoding difference
4. The password `kolhS#24` contains `#` — verify URL encoding is correct (`%23` via `urllib.parse.quote`)
5. Consider using Chrome DevTools Protocol to automate login through Chrome itself (runs all JS, handles all hidden fields natively)

## Guardrails
- **Do NOT modify** `backend\scraper\student_portal\auth.py` or `browser_login.py` (automated login is documented as broken; the app uses the WebView login instead)
- Don't "fix" the known `Wn64` typo in `browser_login.py` unless asked
- Read `frontend\AGENTS.md` — this is Next.js 16, NOT the version you know; read docs in `node_modules\next\dist\docs\` before writing frontend code
- Do not commit stray `backend.zip` / `public.zip` at the repo root
- Commit Capacitor work only when the user asks