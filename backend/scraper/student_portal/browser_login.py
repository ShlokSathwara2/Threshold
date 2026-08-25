"""Playwright-based Student Portal login — runs real Chromium with all JS.

Uses headless Chromium so guardlogin.js, secure2.js, and guardloginbottom.js
all execute natively. This means fpPayload, fpToken, telemetryPayload, and
all dynamic hidden fields are populated by the page's own JavaScript — no
need to reverse-engineer or fake them.

Stealth settings hide the headless/automation markers that the WAF detects.
"""
from __future__ import annotations

import base64
import sys
import threading
import time
import uuid
from dataclasses import dataclass, field

from playwright.async_api import async_playwright, Browser, BrowserContext, Page

from core.schemas.models import LoginResponse

class _ProactorLoopThread:
    """Dedicated thread running a Proactor event loop for Playwright on Windows."""
    def __init__(self):
        self._loop = None
        self._thread = None
        self._ready = threading.Event()

    def _target(self):
        if sys.platform == "win32":
            import asyncio
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        self._loop = asyncio.new_event_loop()
        import asyncio
        asyncio.set_event_loop(self._loop)
        self._ready.set()
        self._loop.run_forever()

    def get_loop(self):
        if self._thread is None:
            self._thread = threading.Thread(target=self._target, daemon=True, name="PlaywrightProactorThread")
            self._thread.start()
            self._ready.wait()
        return self._loop


_proactor_runner = _ProactorLoopThread() if sys.platform == "win32" else None


async def _run_in_proactor(coro_fn, *args, **kwargs):
    import asyncio
    if sys.platform == "win32":
        loop = _proactor_runner.get_loop()
        current_loop = asyncio.get_running_loop()
        if current_loop is not loop:
            future = asyncio.run_coroutine_threadsafe(coro_fn(*args, **kwargs), loop)
            return await asyncio.wrap_future(future)
    return await coro_fn(*args, **kwargs)

_SESSION_TTL = 300  # seconds
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/138.0.0.0 Safari/537.36"
)

# JavaScript to hide automation markers from the WAF / anti-bot scripts.
# Must run before any page JS executes (via add_init_script).
_STEALTH_JS = """
// Hide navigator.webdriver (secure2.js checks this)
Object.defineProperty(navigator, 'webdriver', { get: () => false });

// Spoof Windows platform & userAgent on Linux cloud containers (Render / Fly.io / Docker)
Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
Object.defineProperty(navigator, 'userAgent', {
    get: () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
});
Object.defineProperty(navigator, 'appVersion', {
    get: () => '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
});
Object.defineProperty(navigator, 'vendor', { get: () => 'Google Inc.' });

// Realistic navigator properties
Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });

// Chrome runtime stub (some bot detectors check for window.chrome)
if (!window.chrome) {
    window.chrome = { runtime: {}, loadTimes: function(){}, csi: function(){} };
}

// Permissions API stub
const originalQuery = window.navigator.permissions.query;
if (window.navigator.permissions) {
    window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
    );
}

// WebGL vendor/renderer (headless often returns "Google SwiftShader" or "Mesa")
const getParameter = WebGLRenderingContext.prototype.getParameter;
WebGLRenderingContext.prototype.getParameter = function(parameter) {
    if (parameter === 37445) return 'Intel Inc.';
    if (parameter === 37446) return 'Intel Iris OpenGL Engine';
    return getParameter.call(this, parameter);
};

// Plugin array (headless has 0 plugins)
Object.defineProperty(navigator, 'plugins', {
    get: () => [1, 2, 3, 4, 5]  // non-empty length
});
"""


@dataclass
class _BrowserSession:
    browser: Browser
    context: BrowserContext
    page: Page
    created_at: float = field(default_factory=time.time)


_sessions: dict[str, _BrowserSession] = {}
_pw = None


async def _get_playwright():
    global _pw
    if _pw is None:
        _pw = await async_playwright().start()
    return _pw


async def _sweep_expired():
    now = time.time()
    expired = [k for k, v in _sessions.items() if now - v.created_at > _SESSION_TTL]
    for k in expired:
        await _close_session(k)


async def _close_session(session_id: str):
    s = _sessions.pop(session_id, None)
    if s is None:
        return
    for closer in (s.page.close, s.context.close, s.browser.close):
        try:
            await closer()
        except Exception:
            pass


async def start_login(username: str) -> dict:
    return await _run_in_proactor(_start_login_impl, username)


async def _start_login_impl(username: str) -> dict:
    """Launch stealth headless browser, load SRM login page, screenshot CAPTCHA."""
    await _sweep_expired()

    netid = username.split("@")[0] if "@" in username else username
    print(f"[SP-LOGIN-INIT] Starting browser login for NetID: {netid}")

    pw = await _get_playwright()
    browser = await pw.chromium.launch(
        headless=True,
        args=[
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-software-rasterizer",
            "--no-zygote",
        ],
    )
    context = await browser.new_context(
        user_agent=_USER_AGENT,
        viewport={"width": 1920, "height": 1080},
        locale="en-US",
        timezone_id="Asia/Kolkata",
        color_scheme="light",
        # Don't set extra HTTP headers that leak automation
    )

    # Inject stealth script BEFORE any page JS runs
    await context.add_init_script(_STEALTH_JS)

    page = await context.new_page()

    try:
        print(f"[SP-LOGIN-INIT] Navigating to login page...")
        await page.goto(
            "https://sp.srmist.edu.in/srmiststudentportal/students/loginManager/youLogin.jsp",
            wait_until="networkidle",
            timeout=30000,
        )
        print(f"[SP-LOGIN-INIT] Page loaded, URL: {page.url}")

        # Wait for the CAPTCHA image to be loaded by guardlogin.js
        # guardlogin.js fetches the image via XHR and sets img.src to a blob: URL
        captcha_b64 = await _wait_for_captcha(page)

        if captcha_b64 is None:
            # Fallback: try screenshotting whatever is in the CAPTCHA area
            print("[SP-LOGIN-INIT] CAPTCHA blob wait failed, trying element screenshot fallback")
            captcha_b64 = await _screenshot_captcha_fallback(page)

        if captcha_b64 is None:
            await _close_browser(browser, context, page)
            return {"success": False, "status": 500, "message": "CAPTCHA image failed to load"}

        print(f"[SP-LOGIN-INIT] CAPTCHA captured: {len(captcha_b64)} chars b64")

        session_id = uuid.uuid4().hex
        _sessions[session_id] = _BrowserSession(browser=browser, context=context, page=page)
        print(f"[SP-LOGIN-INIT] Session {session_id} stored, browser kept alive")
        return {"success": True, "session_id": session_id, "captcha_image_base64": captcha_b64}

    except Exception as e:
        print(f"[SP-LOGIN-INIT] Error: {e}")
        await _close_browser(browser, context, page)
        raise


async def _wait_for_captcha(page: Page, timeout_ms: int = 10000) -> str | None:
    """Wait for guardlogin.js to fetch the CAPTCHA and set img.src to a blob: URL,
    then extract the image bytes."""
    try:
        # Wait for img#secure_captcha to have a src that starts with "blob:" or "data:"
        # guardlogin.js does: captchaImg.src = URL.createObjectURL(this.response)
        print("[SP-LOGIN-INIT] Waiting for CAPTCHA image blob URL...")
        await page.wait_for_function(
            """() => {
                const img = document.getElementById('secure_captcha');
                if (!img) return false;
                const src = img.src || '';
                return src.startsWith('blob:') || (src.startsWith('data:') && src.length > 100);
            }""",
            timeout=timeout_ms,
        )
        print("[SP-LOGIN-INIT] CAPTCHA image src is set")

        # Give a moment for the image to fully render
        await page.wait_for_timeout(300)

        # Screenshot just the CAPTCHA image element
        captcha_el = page.locator("img#secure_captcha")
        img_bytes = await captcha_el.screenshot()
        return base64.b64encode(img_bytes).decode()

    except Exception as e:
        print(f"[SP-LOGIN-INIT] CAPTCHA blob wait error: {e}")
        return None


async def _screenshot_captcha_fallback(page: Page) -> str | None:
    """Fallback: screenshot any visible CAPTCHA-like element."""
    try:
        for selector in [
            "img#secure_captcha",
            "img[data-src*='aptcha']",
            "img[src*='aptcha']",
            "img#captchaImg",
        ]:
            el = page.locator(selector).first
            if await el.count() > 0 and await el.is_visible():
                img_bytes = await el.screenshot()
                if len(img_bytes) > 100:
                    return base64.b64encode(img_bytes).decode()
    except Exception as e:
        print(f"[SP-LOGIN-INIT] Fallback screenshot error: {e}")

    # Last resort: screenshot the form area
    try:
        form = page.locator("#login_form")
        if await form.count() > 0:
            img_bytes = await form.screenshot()
            return base64.b64encode(img_bytes).decode()
    except Exception:
        pass

    return None


async def _close_browser(browser, context, page):
    """Safely close browser resources."""
    for closer in (page.close, context.close, browser.close):
        try:
            await closer()
        except Exception:
            pass


async def finish_login(session_id: str, username: str, password: str, captcha_answer: str) -> LoginResponse:
    return await _run_in_proactor(_finish_login_impl, session_id, username, password, captcha_answer)


async def _finish_login_impl(session_id: str, username: str, password: str, captcha_answer: str) -> LoginResponse:
    """Resume the live browser session, type form like a human, submit, extract cookies."""
    session = _sessions.get(session_id)
    if session is None:
        return LoginResponse(success=False, status=400, message="Session expired or invalid. Restart login.")
    if time.time() - session.created_at > _SESSION_TTL:
        await _close_session(session_id)
        return LoginResponse(success=False, status=400, message="Session expired. Restart login.")

    page = session.page
    context = session.context
    netid = username.split("@")[0] if "@" in username else username

    print(f"[SP-LOGIN-VERIFY] Resuming for NetID: {netid}, session {session_id}")

    try:
        # Clear any previous input values (in case of retry)
        for selector in ["#username", "#password", "#captcha"]:
            field_el = page.locator(selector).first
            if await field_el.count() > 0:
                await field_el.fill("")

        # Fill username via exact ID selector #username
        username_input = page.locator("#username").first
        await username_input.click()
        await username_input.fill(netid)
        await page.evaluate(f"(val) => {{ const el = document.querySelector('#username'); if (el) {{ el.removeAttribute('maxlength'); el.value = val; }} }}", netid)
        await username_input.dispatch_event("input")
        await username_input.dispatch_event("change")
        await username_input.dispatch_event("blur")
        print(f"[SP-LOGIN-VERIFY] Filled username: {netid}")

        # Fill password via exact ID selector #password
        password_input = page.locator("#password").first
        await password_input.click()
        await password_input.fill(password)
        await page.evaluate(f"(val) => {{ const el = document.querySelector('#password'); if (el) el.value = val; }}", password)
        await password_input.dispatch_event("input")
        await password_input.dispatch_event("change")
        await password_input.dispatch_event("blur")
        print("[SP-LOGIN-VERIFY] Filled password")

        # Fill CAPTCHA via exact ID selector #captcha
        captcha_input = page.locator("#captcha").first
        await captcha_input.click()
        await captcha_input.fill(captcha_answer)
        await page.evaluate(f"(val) => {{ const el = document.querySelector('#captcha'); if (el) el.value = val; }}", captcha_answer)
        await captcha_input.dispatch_event("input")
        await captcha_input.dispatch_event("change")
        await captcha_input.dispatch_event("blur")
        print(f"[SP-LOGIN-VERIFY] Filled captcha: {captcha_answer}")

        # Verify fields were filled before submitting
        field_values = await page.evaluate("""() => ({
            username: document.querySelector("input[name='username']")?.value || '',
            password: document.querySelector("input[name='password']")?.value || '',
            captcha: document.querySelector("input[name='captcha']")?.value || '',
        })""")
        print(f"[SP-LOGIN-VERIFY] Pre-submit field check: username='{field_values['username']}', "
              f"password={'***' if field_values['password'] else 'EMPTY'}, "
              f"captcha='{field_values['captcha']}'")

        if not field_values['username'] or not field_values['password']:
            print("[SP-LOGIN-VERIFY] WARNING: Fields are empty before submit!")

        # Small delay to simulate human pause before submit
        await page.wait_for_timeout(500)

        # Click submit — JS will append all hidden fields (domainFieldName,
        # captchaFieldName, telemetryPayload) via the submit event listeners
        submit_btn = page.locator("#btnLogin, button[type='submit']").first
        print("[SP-LOGIN-VERIFY] Clicking submit...")

        try:
            async with page.expect_navigation(timeout=15000, wait_until="networkidle"):
                await submit_btn.click()
        except Exception as nav_err:
            # Navigation might not happen if form submits via AJAX or page stays
            print(f"[SP-LOGIN-VERIFY] Navigation event: {nav_err}")

        final_url = page.url
        print(f"[SP-LOGIN-VERIFY] Final URL: {final_url}")

        resp_html = await page.content()
        resp_lower = resp_html.lower()

        # Check if still on login page (login failed)
        is_on_login_page = "youlogin" in final_url.lower() or (
            "login" in final_url.lower() and "template" not in final_url.lower()
        )
        has_login_form = 'id="login_form"' in resp_lower

        if is_on_login_page and has_login_form:
            # Login failed — extract error message
            error_msg = await _extract_error(page, resp_lower)
            print(f"[SP-LOGIN-VERIFY] Login failed: {error_msg}")

            # Capture debug screenshot
            debug_ss = None
            try:
                ss_bytes = await page.screenshot(full_page=True)
                debug_ss = base64.b64encode(ss_bytes).decode()
            except Exception:
                pass

            # Extract visible error elements
            debug_errors = await _extract_error_elements(page)

            # Check if it's a CAPTCHA-specific error (session stays alive for retry)
            is_captcha_error = "captcha" in error_msg.lower()

            if not is_captcha_error:
                # Non-CAPTCHA error — close session
                await _close_session(session_id)

            return LoginResponse(
                success=False,
                status=401,
                message=error_msg,
                debug_screenshot_base64=debug_ss,
                debug_errors=debug_errors or None,
            )

        # Login succeeded! Extract cookies
        cookies = await context.cookies()
        cookie_header = "; ".join(f"{c['name']}={c['value']}" for c in cookies)
        print(f"[SP-LOGIN-VERIFY] Extracted {len(cookies)} cookies, header length: {len(cookie_header)}")

        if not cookie_header:
            await _close_session(session_id)
            return LoginResponse(success=False, status=401, message="No session cookies established")

        print("[SP-LOGIN-VERIFY] Success!")
        await _close_session(session_id)
        return LoginResponse(success=True, status=200, message="Success", cookies=cookie_header)

    except Exception as e:
        print(f"[SP-LOGIN-VERIFY] Error: {e}")

        debug_ss = None
        try:
            ss_bytes = await page.screenshot(full_page=True)
            debug_ss = base64.b64encode(ss_bytes).decode()
        except Exception:
            pass

        await _close_session(session_id)
        return LoginResponse(
            success=False,
            status=500,
            message=f"Login error: {e}",
            debug_screenshot_base64=debug_ss,
        )


async def refresh_captcha(session_id: str) -> dict:
    return await _run_in_proactor(_refresh_captcha_impl, session_id)


async def _refresh_captcha_impl(session_id: str) -> dict:
    """Refresh CAPTCHA image for a live browser session."""
    session = _sessions.get(session_id)
    if not session:
        return {"success": False, "message": "Session expired. Please try again."}

    page = session.page
    print(f"[SP-LOGIN-REFRESH] Refreshing CAPTCHA for session {session_id}...")

    try:
        # Clear existing image src so _wait_for_captcha waits for the NEW blob URL
        try:
            await page.evaluate("() => { const img = document.getElementById('secure_captcha'); if (img) img.src = ''; }")
        except Exception:
            pass

        # Click refresh button or re-navigate if on error page
        refresh_btn = page.locator("#btnRefresh, button:has(.fa-recycle)").first
        if await refresh_btn.count() > 0 and await refresh_btn.is_visible():
            await refresh_btn.click()
            await page.wait_for_timeout(600)
        else:
            # Re-navigate to login page
            await page.goto(
                "https://sp.srmist.edu.in/srmiststudentportal/students/loginManager/youLogin.jsp",
                wait_until="networkidle",
                timeout=30000,
            )

        captcha_b64 = await _wait_for_captcha(page, timeout_ms=10000)
        if not captcha_b64:
            captcha_b64 = await _screenshot_captcha_fallback(page)

        if not captcha_b64:
            return {"success": False, "message": "Failed to refresh CAPTCHA image"}

        session.created_at = time.time()
        print(f"[SP-LOGIN-REFRESH] CAPTCHA refreshed successfully for session {session_id}")
        return {"success": True, "captcha_image_base64": captcha_b64}

    except Exception as e:
        print(f"[SP-LOGIN-REFRESH] Refresh error: {e}")
        return {"success": False, "message": f"Refresh error: {e}"}


async def _extract_error(page: Page, resp_lower: str) -> str:
    """Extract human-readable error text strictly from visible alert elements on the page."""
    try:
        alert_els = page.locator(
            ".alert, [role='alert'], .alert-icon-content, #errorMsg, "
            ".error-message, .text-danger, [class*='alert']"
        )
        count = await alert_els.count()
        for i in range(count):
            el = alert_els.nth(i)
            if await el.is_visible():
                txt = (await el.inner_text()).strip()
                if txt:
                    clean_txt = txt.replace("Alert", "").strip()
                    if clean_txt:
                        return clean_txt
    except Exception:
        pass

    # Fallback to specific exact phrases
    if "invalid credentials" in resp_lower:
        return "Invalid NetID or password."
    if "invalid captcha" in resp_lower or "captcha mismatch" in resp_lower or "incorrect captcha" in resp_lower:
        return "Incorrect CAPTCHA. Please try again."
    if "too many" in resp_lower:
        return "Too many login attempts. Please try again later."

    return "Login failed. Please try again."


async def _extract_error_elements(page: Page) -> list[str]:
    """Extract text from all visible error/alert elements."""
    debug_errors: list[str] = []
    try:
        error_els = page.locator(
            ".error, .alert, [class*='error'], [id*='error'], "
            "[class*='alert'], [role='alert'], .text-danger, "
            "[class*='warning'], [id*='alert']"
        )
        count = await error_els.count()
        for i in range(min(count, 10)):
            txt = (await error_els.nth(i).inner_text()).strip()
            if txt:
                debug_errors.append(txt)
                print(f"[SP-LOGIN-VERIFY] Page error element [{i}]: {txt}")
    except Exception as el_err:
        print(f"[SP-LOGIN-VERIFY] Error element extraction failed: {el_err}")
    return debug_errors
