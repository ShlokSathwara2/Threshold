"""Curl-based Student Portal login — bypasses WAF TLS fingerprinting.

Uses curl.exe (libcurl) instead of Python requests/httpx, which have different
JA3 TLS fingerprints that trigger the Imperva/F5 WAF. curl.exe uses the same
TLS stack as real browsers, so the WAF accepts it.
"""
from __future__ import annotations

import base64
import json
import os
import re
import subprocess
import tempfile
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import quote

from core.schemas.models import LoginResponse

_SESSION_TTL = 300  # seconds
_SP_BASE = "https://sp.srmist.edu.in"
_SP_LOGIN_PAGE = f"{_SP_BASE}/srmiststudentportal/students/loginManager/youLogin.jsp"
_SP_CAPTCHA = f"{_SP_BASE}/srmiststudentportal/SCaptchaServlet"
_SP_LOGIN_ACTION = f"{_SP_BASE}/srmiststudentportal/LoginServlet"
_SP_HRD = f"{_SP_BASE}/srmiststudentportal/students/template/HRDSystem.jsp"
_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

# curl.exe path — prefer System32, fall back to PATH
_CURL = "curl.exe"


def _build_synthetic_telemetry() -> str:
    """Build a plausible telemetry payload matching secure2.js's format.

    secure2.js collects browser telemetry and base64-encodes the JSON.
    The server may validate presence and structure (not exact values).
    """
    import random

    now_ms = int(time.time() * 1000)
    telemetry = {
        "startTime": now_ms - random.randint(3000, 8000),
        "currentDomain": "sp.srmist.edu.in",
        "timezoneOffset": -330,  # IST = UTC+5:30 → offset is -330
        "screenWidth": 1920,
        "screenHeight": 1080,
        "colorDepth": 24,
        "devicePixelRatio": 1,
        "platform": "Win32",
        "userAgent": _UA,
        "language": "en-US",
        "hardwareConcurrency": 8,
        "deviceMemory": 8,
        "touchSupport": False,
        "webdriver": False,       # Critical — secure2.js checks this
        "mouseClicks": random.randint(2, 6),
        "mouseMovements": random.randint(5, 20),
        "keystrokeCount": random.randint(10, 30),
        "typingSpeedMs": random.randint(2000, 5000),
        "canvasHash": format(random.getrandbits(32), 'x'),  # hex hash
        "submitTime": now_ms,
        "timeOnPageMs": random.randint(3000, 8000),
    }
    json_str = json.dumps(telemetry)
    # secure2.js uses safeBase64Encode: btoa(encodeURIComponent(str).replace(...))
    # Simplified: just base64-encode the JSON (ASCII-safe)
    return base64.b64encode(json_str.encode()).decode()


def _curl(args: list[str], cookie_file: str, extra_headers: list[str] | None = None) -> tuple[int, str]:
    """Run curl.exe and return (status_code, stdout)."""
    status_fd, status_file = tempfile.mkstemp(suffix=".txt", prefix="curl_status_")
    os.close(status_fd)
    try:
        cmd = [_CURL, "-w", f"%{{http_code}}", "-b", cookie_file, "-c", cookie_file]
        cmd += ["-H", f"User-Agent: {_UA}"]
        if extra_headers:
            for h in extra_headers:
                cmd += ["-H", h]
        cmd += args + ["-o", status_file + ".body"]
        result = subprocess.run(cmd, capture_output=True, timeout=30)
        # Read status code from the -w output (written to stdout)
        code_str = result.stdout.decode("utf-8", errors="replace").strip()
        try:
            code = int(code_str)
        except ValueError:
            code = 0
        # Read body
        body = ""
        body_file = status_file + ".body"
        if os.path.exists(body_file):
            with open(body_file, "r", errors="replace") as f:
                body = f.read()
            os.unlink(body_file)
        return code, body
    finally:
        try:
            os.unlink(status_file)
        except OSError:
            pass


def _curl_binary(args: list[str], cookie_file: str, output_file: str, extra_headers: list[str] | None = None) -> tuple[int, int]:
    """Run curl.exe writing body to output_file. Returns (status_code, file_size)."""
    status_fd, status_file = tempfile.mkstemp(suffix=".txt", prefix="curl_status_")
    os.close(status_fd)
    try:
        cmd = [_CURL, "-w", f"%{{http_code}}", "-b", cookie_file, "-c", cookie_file]
        cmd += ["-H", f"User-Agent: {_UA}"]
        if extra_headers:
            for h in extra_headers:
                cmd += ["-H", h]
        cmd += args + ["-o", output_file]
        result = subprocess.run(cmd, capture_output=True, timeout=30)
        code_str = result.stdout.decode("utf-8", errors="replace").strip()
        try:
            code = int(code_str)
        except ValueError:
            code = 0
        size = os.path.getsize(output_file) if os.path.exists(output_file) else 0
        return code, size
    finally:
        try:
            os.unlink(status_file)
        except OSError:
            pass


@dataclass
class _CurlSession:
    cookie_file: str
    created_at: float = field(default_factory=time.time)
    nonce: str = ""
    challenge_id: str = ""
    fp_nonce: str = ""
    honeypot_name: str = ""
    domain_field: str = "dtoken"
    captcha_field: str = "cptoken"
    random_delimiter: str = ""


_sessions: dict[str, _CurlSession] = {}


def _sweep_expired():
    now = time.time()
    expired = [k for k, v in _sessions.items() if now - v.created_at > _SESSION_TTL]
    for k in expired:
        _close_session(k)


def _close_session(session_id: str):
    s = _sessions.pop(session_id, None)
    if s is None:
        return
    try:
        os.unlink(s.cookie_file)
    except OSError:
        pass


def start_login(username: str) -> dict:
    """Fetch login page + CAPTCHA via curl, return base64 CAPTCHA image."""
    _sweep_expired()

    netid = username.split("@")[0] if "@" in username else username
    print(f"[SP-CURL-LOGIN] Starting login for NetID: {netid}")

    cookie_fd, cookie_file = tempfile.mkstemp(suffix=".txt", prefix="sp_cookies_")
    os.close(cookie_fd)

    # Step 1: GET login page
    print("[SP-CURL-LOGIN] Step 1: GET login page...")
    code, body = _curl(
        ["-H", "Accept: text/html", "-H", "Accept-Encoding: identity", _SP_LOGIN_PAGE],
        cookie_file,
    )
    print(f"[SP-CURL-LOGIN] Login page: {code}, {len(body)} bytes")

    if code != 200 or "SECURE_CONFIG" not in body:
        _close_session(cookie_file)
        return {"success": False, "status": code, "message": f"Failed to load login page ({code})"}

    # Extract nonce
    nonce_match = re.search(r"nonce:\s*'([^']+)'", body)
    nonce = nonce_match.group(1) if nonce_match else ""
    print(f"[SP-CURL-LOGIN] Nonce: {nonce}")

    # Extract CAPTCHA text from page (embedded in SECURE_CONFIG)
    captcha_text_match = re.search(r"captchaText\s*=\s*'([^']+)'", body)
    captcha_text_from_page = captcha_text_match.group(1) if captcha_text_match else ""
    print(f"[SP-CURL-LOGIN] CaptchaText: {captcha_text_from_page}")

    # Extract challengeId
    challenge_match = re.search(r'id="challengeId"\s+value="([^"]*)"', body)
    challenge_id = challenge_match.group(1) if challenge_match else ""
    print(f"[SP-CURL-LOGIN] ChallengeId: {challenge_id}")

    # Extract fpNonce
    fp_match = re.search(r'id="fpNonce"\s+value="([^"]*)"', body)
    fp_nonce = fp_match.group(1) if fp_match else ""
    print(f"[SP-CURL-LOGIN] FpNonce: {fp_nonce}")

    # Extract dynamic hidden field names (added by guardlogin.js on submit)
    domain_field_match = re.search(r"domainFieldName\s*=\s*'([^']+)'", body)
    domain_field_name = domain_field_match.group(1) if domain_field_match else "dtoken"
    captcha_field_match = re.search(r"captchaFieldName\s*=\s*'([^']+)'", body)
    captcha_field_name = captcha_field_match.group(1) if captcha_field_match else "cptoken"

    # Extract randomDelimiter — used by guardlogin.js as separator in captchaFieldName value
    delimiter_match = re.search(r"randomDelimiter\s*=\s*'([^']+)'", body)
    random_delimiter = delimiter_match.group(1) if delimiter_match else ""
    print(f"[SP-CURL-LOGIN] DomainField: {domain_field_name}, CaptchaField: {captcha_field_name}, Delimiter: {random_delimiter}")

    # Extract honeypot field name (ph_xxxxxxxx pattern)
    honeypot_match = re.search(r'name="(ph_[a-f0-9]+)"', body)
    honeypot_name = honeypot_match.group(1) if honeypot_match else ""
    print(f"[SP-CURL-LOGIN] Honeypot: {honeypot_name}")

    # Step 2: GET CAPTCHA
    print("[SP-CURL-LOGIN] Step 2: GET CAPTCHA...")
    ts = int(time.time() * 1000)
    cap_token = uuid.uuid4().hex

    captcha_fd, captcha_file = tempfile.mkstemp(suffix=".png", prefix="sp_captcha_")
    os.close(captcha_fd)

    code, cap_size = _curl_binary(
        [
            "-H", f"Referer: {_SP_LOGIN_PAGE}",
            "-H", "Accept: image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            f"{_SP_CAPTCHA}?ts={ts}&token={cap_token}",
        ],
        cookie_file,
        captcha_file,
    )
    print(f"[SP-CURL-LOGIN] CAPTCHA: {code}, {cap_size} bytes")

    if code != 200 or cap_size < 100:
        _close_session(cookie_file)
        try:
            os.unlink(captcha_file)
        except OSError:
            pass
        return {"success": False, "status": code, "message": f"Failed to fetch CAPTCHA ({code}, {cap_size} bytes)"}

    # Read CAPTCHA and encode to base64
    with open(captcha_file, "rb") as f:
        captcha_bytes = f.read()
    captcha_b64 = base64.b64encode(captcha_bytes).decode()

    try:
        os.unlink(captcha_file)
    except OSError:
        pass

    # Store session
    session_id = uuid.uuid4().hex
    _sessions[session_id] = _CurlSession(
        cookie_file=cookie_file,
        nonce=nonce,
        challenge_id=challenge_id,
        fp_nonce=fp_nonce,
        honeypot_name=honeypot_name,
        domain_field=domain_field_name,
        captcha_field=captcha_field_name,
        random_delimiter=random_delimiter,
    )
    print(f"[SP-CURL-LOGIN] Session {session_id} stored")

    return {
        "success": True,
        "session_id": session_id,
        "captcha_image_base64": captcha_b64,
    }


def finish_login(session_id: str, username: str, password: str, captcha: str) -> LoginResponse:
    """Submit login with CAPTCHA answer via curl."""
    session = _sessions.get(session_id)
    if not session:
        return LoginResponse(success=False, status=400, message="Session expired. Please try again.")

    netid = username.split("@")[0] if "@" in username else username
    print(f"[SP-CURL-LOGIN] Finishing login for NetID: {netid}, session: {session_id}")

    # Compute the two hidden fields that guardlogin.js adds on form submit
    # 1. domainFieldName = btoa(reversedHost)
    reversed_host = "sp.srmist.edu.in"[::-1]  # "ni.ude.stimrs.ps"
    domain_value = base64.b64encode(reversed_host.encode()).decode()

    # 2. captchaFieldName = btoa(timeElapsed + randomDelimiter + interactCount)
    #    guardlogin.js uses SECURE_CONFIG.randomDelimiter as separator, NOT nonce
    time_elapsed = 5  # plausible seconds on page
    interact_count = 3  # plausible mouse/key interactions
    delimiter = session.random_delimiter or ""
    captcha_token_raw = f"{time_elapsed}{delimiter}{interact_count}"
    captcha_field_value = base64.b64encode(captcha_token_raw.encode()).decode()

    # 3. telemetryPayload — secure2.js collects browser telemetry and base64-encodes it
    #    Server may validate presence and structure of this field
    telemetry_payload = _build_synthetic_telemetry()

    # Build form body — match the exact field set the browser sends
    body_parts = [
        f"username={quote(netid)}",
        f"password={quote(password)}",
        f"captcha={quote(captcha)}",
        f"{session.domain_field}={quote(domain_value)}",
        f"{session.captcha_field}={quote(captcha_field_value)}",
        f"telemetryPayload={quote(telemetry_payload)}",
        f"fpPayload=",   # HTML has this field; JS never populates it
        f"fpToken=",     # HTML has this field; JS never populates it
    ]

    if session.challenge_id:
        body_parts.append(f"challengeId={quote(session.challenge_id)}")
    if session.fp_nonce:
        body_parts.append(f"fpNonce={quote(session.fp_nonce)}")
    if session.honeypot_name:
        body_parts.append(f"{session.honeypot_name}=")

    body = "&".join(body_parts)
    print(f"[SP-CURL-LOGIN] Form fields: {[p.split('=')[0] for p in body_parts]}")

    # POST login
    print("[SP-CURL-LOGIN] POST login...")
    code, response = _curl(
        [
            "-X", "POST",
            "-H", "Content-Type: application/x-www-form-urlencoded",
            "-H", "X-Requested-With: XMLHttpRequest",
            "-H", f"Origin: {_SP_BASE}",
            "-H", f"Referer: {_SP_LOGIN_PAGE}",
            "-d", body,
            _SP_LOGIN_ACTION,
        ],
        session.cookie_file,
    )
    print(f"[SP-CURL-LOGIN] Login response: {code}, {len(response)} bytes")

    # Check if login succeeded (redirect to HRDSystem or response contains it)
    if code == 200 and ("HRDSystem" in response or "template" in response):
        print("[SP-CURL-LOGIN] Login SUCCESS!")
        # Read cookies from file
        cookie_str = _read_cookies(session.cookie_file)
        _close_session(session_id)
        return LoginResponse(success=True, cookies=cookie_str, status=200)

    # Check for error messages in response
    error_msg = "Login failed"
    # Extract alert content specifically
    alert_match = re.search(r'alert-icon-content[^>]*>\s*<h6[^>]*>[^<]*</h6>\s*([^<]+)', response)
    alert_text = alert_match.group(1).strip() if alert_match else ""

    if "Invalid credentials" in response:
        error_msg = "Invalid credentials — check your NetID, password, or CAPTCHA."
    elif "captcha" in alert_text.lower() or "captcha" in response.lower() and ("incorrect" in response.lower() or "wrong" in response.lower()):
        error_msg = "Incorrect CAPTCHA. Please try again."
    elif "too many" in response.lower():
        error_msg = "Too many attempts. Please try again later."
    elif "locked" in response.lower():
        error_msg = "Account locked. Please try again later."
    else:
        # Truncate for readability
        error_msg = f"Login failed. Server returned {code} ({len(response)} bytes)."

    print(f"[SP-CURL-LOGIN] Login FAILED: {error_msg}")

    # If CAPTCHA was wrong, the session is still valid for retry
    if "captcha" in error_msg.lower():
        return LoginResponse(success=False, status=401, message=error_msg)

    # Other errors — clean up session
    _close_session(session_id)
    return LoginResponse(success=False, status=code, message=error_msg)


def _read_cookies(cookie_file: str) -> str:
    """Read Netscape cookie file and return semicolon-separated cookie string."""
    cookies = []
    try:
        with open(cookie_file, "r") as f:
            for line in f:
                line = line.strip()
                if line.startswith("#") or not line:
                    continue
                parts = line.split("\t")
                if len(parts) >= 7:
                    name = parts[5]
                    value = parts[6]
                    cookies.append(f"{name}={value}")
    except Exception:
        pass
    return "; ".join(cookies)


def refresh_captcha(session_id: str) -> dict:
    """Get a new CAPTCHA for an existing session (when CAPTCHA was wrong)."""
    session = _sessions.get(session_id)
    if not session:
        return {"success": False, "message": "Session expired. Please try again."}

    ts = int(time.time() * 1000)
    cap_token = uuid.uuid4().hex

    captcha_fd, captcha_file = tempfile.mkstemp(suffix=".png", prefix="sp_captcha_")
    os.close(captcha_fd)

    code, cap_size = _curl_binary(
        [
            "-H", f"Referer: {_SP_LOGIN_PAGE}",
            "-H", "Accept: image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            f"{_SP_CAPTCHA}?ts={ts}&token={cap_token}",
        ],
        session.cookie_file,
        captcha_file,
    )

    if code != 200 or cap_size < 100:
        try:
            os.unlink(captcha_file)
        except OSError:
            pass
        return {"success": False, "message": f"Failed to refresh CAPTCHA ({code})"}

    with open(captcha_file, "rb") as f:
        captcha_bytes = f.read()
    captcha_b64 = base64.b64encode(captcha_bytes).decode()

    try:
        os.unlink(captcha_file)
    except OSError:
        pass

    # Update session creation time so it doesn't expire
    session.created_at = time.time()

    return {"success": True, "captcha_image_base64": captcha_b64}
