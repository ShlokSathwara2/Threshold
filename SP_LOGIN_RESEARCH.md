# Student Portal Login — Research & Implementation Guide

> **Date:** August 31, 2026
> **Status:** Proxy verified working. Ready to implement.
> **Last tested:** Login + Attendance + Profile via `sp-api.srminsider.in`

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Root Cause Analysis](#2-root-cause-analysis)
3. [How AcadLoop Solves It](#3-how-acadloop-solves-it)
4. [Threshold's Current Architecture](#4-thresholds-current-architecture)
5. [Proxy API Reference](#5-proxy-api-reference)
6. [Solution Options](#6-solution-options)
7. [Testing Plan](#7-testing-plan)
8. [Implementation Steps](#8-implementation-steps)
9. [Code References](#9-code-references)

---

## 1. Problem Statement

SP (Student Portal) login fails when the backend is deployed on Render (non-Indian IP). The WAF on `sp.srmist.edu.in` blocks cloud provider IPs outside India.

**Symptoms:**
- Login hangs or returns error
- Works locally (in India) but fails on Render
- Works from phone (Indian IP) but not from cloud servers

---

## 2. Root Cause Analysis

### Why it fails

1. **IP Geoblocking:** SRM's WAF (Imperva/F5) blocks non-Indian cloud IPs
2. **JA3 TLS Fingerprinting:** Python httpx/requests have distinctive TLS fingerprints that WAF flags as bot traffic
3. **Headless Browser Detection:** `secure2.js` checks `navigator.webdriver`, plugins, WebGL renderer
4. **Telemetry Validation:** Server validates mouse movements, keystrokes, time on page

### Evidence from code

- `browser_login.py` line 74: "Spoof Windows platform & userAgent on Linux cloud containers (Render / Fly.io / Docker)"
- `curl_login.py` line 1-6: "Uses curl.exe (libcurl) instead of Python requests/httpx, which have different JA3 TLS fingerprints that trigger the Imperva/F5 WAF"
- Three progressively more sophisticated login implementations exist (httpx → curl → Playwright with stealth)

### Render deployment location

- Render servers are in US/EU (not India)
- SRM WAF blocks these IPs at network level
- No code fix possible — must deploy in India

---

## 3. How AcadLoop Solves It

### Architecture

```
Frontend (Vercel)
    ↓
sp-api.srminsider.in (AWS API Gateway - Mumbai)
    ↓
sp.srmist.edu.in (SRM Student Portal)
```

### Key insight

AcadLoop uses an **external proxy** (`sp-api.srminsider.in`) deployed on AWS in Mumbai. This proxy:
- Is in India (bypasses geoblocking)
- Uses Puppeteer/HTTP (bypasses WAF)
- Handles CAPTCHA generation
- Returns session tokens

### AcadLoop's SP status endpoint

```
GET https://acad-loop.vercel.app/api/sp/status
Response: {"engine":"puppeteer+http","scrappeyConfigured":false,"proxyConfigured":false,"cloudWithoutProxy":false,"studentPortalReachable":true}
```

### Verified working endpoints

| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `/api/auth/login-context` | GET | ✅ | Get CAPTCHA image + session tokens |
| `/api/auth/login` | POST | ✅ | Submit credentials + CAPTCHA |
| `/api/student/attendance` | GET | ✅ | Fetch attendance (full course list) |
| `/api/student/profile` | GET | ✅ | Fetch student profile |

### Not available on proxy (404)

- `/api/student/marks`
- `/api/student/timetable`
- `/api/student/calendar`
- `/api/student/internal-marks`
- `/api/student/grades`

---

## 4. Threshold's Current Architecture

### Frontend → Backend flow

```
Browser (Vercel)
    ↓
/api/campus-login (Next.js route)
    ↓
campusapi.fly.dev (EXTERNAL - broken, returns 404)
    ↓
sp.srmist.edu.in
```

### Backend → SP flow (direct)

```
Browser (Vercel)
    ↓
threshold-1-ly01.onrender.com (Python FastAPI)
    ↓
sp.srmist.edu.in (BLOCKED - non-Indian IP)
```

### Problem

1. `campusapi.fly.dev` is broken (404)
2. Render backend is outside India (WAF blocks)
3. Frontend SP login page calls `campusWebLogin()` which goes to broken Fly.io

### Current SP login methods (all broken on Render)

| Endpoint | Method | Implementation | Why it fails |
|----------|--------|---------------|-------------|
| `/sp/login` | POST | `auth.py` (httpx) | WAF blocks non-Indian IP |
| `/sp/login-init` | POST | `browser_login.py` | Playwright can't bypass WAF from outside India |
| `/sp/login-verify` | POST | `browser_login.py` | Same |
| `/sp/curl-login-init` | POST | `curl_login.py` | curl bypasses JA3 but IP still blocked |
| `/sp/curl-login-verify` | POST | `curl_login.py` | Same |

---

## 5. Proxy API Reference

### Base URL

```
https://sp-api.srminsider.in
```

### Endpoints

#### GET /api/auth/login-context

Returns CAPTCHA image and session tokens.

**Response:**
```json
{
  "captchaImageBase64": "iVBORw0KGgo...",
  "challengeId": "37b06396-cd54-48db-b869-279318380096",
  "cptoken": "cptoken_6fc417",
  "dname": null,
  "dtoken": "dtoken_c8cb44",
  "fpNonce": "989de949-d600-4eba-be79-56cf8411c826",
  "nonce": "c1f1995f-cd43-47d6-afb6-bfac9cc2fe1c",
  "phFieldName": "ph_d34074e9",
  "randomDelimiter": "52e3",
  "sessionId": "9e7b9db3-42c3-45b8-bb89-fec00cc78dc2"
}
```

#### POST /api/auth/login

Submit credentials + CAPTCHA answer.

**Request:**
```json
{
  "username": "ss1516",
  "password": "kolhS#24",
  "captcha": "5Y37Kz",
  "sessionId": "9557f437-ea05-4edc-bef3-15573305a242",
  "dtokenFieldName": "dtoken_e09b4c",
  "cptokenFieldName": "cptoken_a57c3d",
  "randomDelimiter": "e8b6"
}
```

**Response:**
```
"Login successful"
```

#### GET /api/student/attendance?sessionId={sessionId}

Fetch attendance data.

**Response:**
```json
{
  "courses": [
    {
      "absentHours": 0,
      "attendedHours": 15,
      "canSkip": 5,
      "code": "21CSC301T",
      "description": "FORMAL LANGUAGE AND AUTOMATA",
      "maxHours": 15,
      "needToAttend": 0,
      "percentage": 100.0
    }
  ],
  "monthly": [
    {
      "absent": 2,
      "monthYear": "Jul-2026",
      "present": 39
    }
  ],
  "totalAbsent": 24,
  "totalPresent": 130
}
```

#### GET /api/student/profile?sessionId={sessionId}

Fetch student profile.

**Response:**
```json
{
  "name": "SHLOK PARESH SATHWARA",
  "program": "B.Tech.-Computer Science and Engineering[UG - FT - ACADEMIC]",
  "registerNo": "RA2411003010247",
  "semester": "V SEMESTER",
  "studentMobileNo": "9687271268"
}
```

### Test credentials used

- NetID: `ss1516`
- Password: `kolhS#24`
- Tested: August 31, 2026 — Login successful, attendance + profile fetched

---

## 6. Solution Options

### Option 1: Use external proxy (Simplest — no deployment)

**What:** Call `sp-api.srminsider.in` directly from frontend
**Pros:** Zero deployment, works now
**Cons:** External dependency, only attendance + profile available
**Best for:** Quick MVP, proving SP login works

### Option 2: Deploy proxy on Fly.io Mumbai (Recommended)

**What:** Deploy existing backend code to Fly.io in `bom1` (Mumbai) region
**Pros:** Free tier, full control, all endpoints work, your own infrastructure
**Cons:** New deployment, need to maintain
**Best for:** Production use

### Option 3: Deploy proxy on Vercel Mumbai

**What:** Convert backend to Vercel serverless functions in `bom1` region
**Pros:** Integrated with frontend, free tier
**Cons:** 10s timeout (free) / 30s (pro), Playwright may not fit
**Best for:** If you don't need Playwright login

### Option 4: Indian VPS

**What:** Rent a VPS in India (Contabo, Hetzner, DigitalOcean)
**Pros:** Full control, no timeouts, can run anything
**Cons:** Costs ₹400-700/month
**Best for:** Maximum reliability

### Recommendation

**Start with Option 1** (prove it works), then **move to Option 2** (Fly.io Mumbai) for production.

---

## 7. Testing Plan

### Phase 1: Verify proxy works (done ✓)

```bash
# Get CAPTCHA
curl "https://sp-api.srminsider.in/api/auth/login-context"

# Login
curl -X POST "https://sp-api.srminsider.in/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"ss1516","password":"kolhS#24","captcha":"5Y37Kz","sessionId":"...","dtokenFieldName":"...","cptokenFieldName":"...","randomDelimiter":"..."}'

# Fetch attendance
curl "https://sp-api.srminsider.in/api/student/attendance?sessionId=..."
```

### Phase 2: Test locally

```bash
# Run frontend locally
cd frontend
npm run dev

# Open on phone (same WiFi)
http://YOUR_LAPTOP_IP:3000

# Test SP login flow
```

### Phase 3: Staging branch

```bash
git checkout -b sp-primary
# Make changes
git push origin sp-primary
# Test on Vercel preview URL
```

### Phase 4: Production

```bash
# Deploy proxy to Fly.io Mumbai
fly launch --name threshold-proxy --region bom1
fly deploy

# Update frontend to use new proxy
# Merge to main
```

---

## 8. Implementation Steps

### Step 1: Create API route for SP proxy (Frontend)

File: `frontend/src/app/api/sp-login/route.ts`

```typescript
// Proxy to sp-api.srminsider.in from Vercel Mumbai
import { NextRequest, NextResponse } from 'next/server';

const PROXY_BASE = 'https://sp-api.srminsider.in';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  if (action === 'login-context') {
    const res = await fetch(`${PROXY_BASE}/api/auth/login-context`);
    const data = await res.json();
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, ...data } = body;

  if (action === 'login') {
    const res = await fetch(`${PROXY_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
```

### Step 2: Update SP login page

File: `frontend/src/app/sp-login/page.tsx`

Replace `campusWebLogin()` calls with proxy calls:

```typescript
// Old: const res = await campusWebLogin(username, password);
// New:
const context = await fetch('/api/sp-login?action=login-context').then(r => r.json());
// Show CAPTCHA to user
// On submit:
const loginResult = await fetch('/api/sp-login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'login',
    username,
    password,
    captcha: captchaAnswer,
    sessionId: context.sessionId,
    dtokenFieldName: context.dtoken,
    cptokenFieldName: context.cptoken,
    randomDelimiter: context.randomDelimiter,
  }),
}).then(r => r.json());
```

### Step 3: Update data fetching

For attendance, call the proxy directly:

```typescript
export async function fetchSpAttendance(sessionId: string) {
  const res = await fetch(`https://sp-api.srminsider.in/api/student/attendance?sessionId=${sessionId}`);
  return res.json();
}
```

For marks/timetable, keep using Academia (existing code works).

### Step 4: Deploy proxy to Fly.io (Production)

```bash
# In project root
fly launch --name threshold-proxy --region bom1

# Set environment variables
fly secrets set PORT=8000

# Deploy
fly deploy

# Verify
curl https://threshold-proxy.fly.dev/hello
```

### Step 5: Update frontend API base

```typescript
// In frontend/src/lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://threshold-proxy.fly.dev';
```

---

## 9. Code References

### Threshold backend (existing SP code)

| File | Purpose |
|------|---------|
| `backend/core/config.py` | All URL configs (sp_base_url, sp_context_path) |
| `backend/scraper/student_portal/auth.py` | SP login via httpx |
| `backend/scraper/student_portal/curl_login.py` | SP login via curl (WAF bypass) |
| `backend/scraper/student_portal/browser_login.py` | SP login via Playwright |
| `backend/scraper/student_portal/data.py` | SP data fetching (attendance, marks, etc.) |
| `backend/web/routes.py` | FastAPI routes for all SP endpoints |

### Threshold frontend (SP-related)

| File | Purpose |
|------|---------|
| `frontend/src/app/sp-login/page.tsx` | SP login UI |
| `frontend/src/app/login/page.tsx` | Main login page (Academia) |
| `frontend/src/lib/api.ts` | API client (campusWebLogin, apiFetch) |
| `frontend/src/app/api/campus-login/route.ts` | Campus Web login proxy (broken) |
| `frontend/src/app/api/campus-proxy/route.ts` | Campus Web data proxy (broken) |

### Deployment configs

| File | Purpose |
|------|---------|
| `render.yaml` | Render deployment (backend - outside India) |
| `Dockerfile` | Docker config for backend |
| `backend/Dockerfile` | Alternative Docker config |
| `frontend/capacitor.config.ts` | Android app config |

### External services

| Service | URL | Status |
|---------|-----|--------|
| AcadLoop SP proxy | `sp-api.srminsider.in` | ✅ Working |
| Campus Web API | `campusapi.fly.dev` | ❌ Broken (404) |
| Threshold backend | `threshold-1-ly01.onrender.com` | ✅ Working (but SP blocked) |

---

## Summary

| Question | Answer |
|----------|--------|
| Why does SP login fail? | Render is outside India, WAF blocks non-Indian IPs |
| How does AcadLoop fix it? | Uses `sp-api.srminsider.in` (AWS Mumbai proxy) |
| Can we use the same proxy? | Yes, verified working (login + attendance + profile) |
| Can we build our own? | Yes, deploy existing backend to Fly.io Mumbai |
| What's the cheapest option? | Fly.io free tier (bom1 region) |
| What data is available via proxy? | Login, Attendance, Profile (marks/timetable need own proxy) |
| Recommended approach? | Use external proxy first, then deploy own proxy for full control |

---

*Research completed August 31, 2026. Tested with live credentials.*
