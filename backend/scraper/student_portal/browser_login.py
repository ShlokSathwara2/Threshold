from __future__ import annotations

import base64
import time
import uuid
from dataclasses import dataclass, field

from playwright.async_api import async_playwright, Browser, BrowserContext, Page

from core.config import settings
from core.schemas.models import LoginResponse

_SESSION_TTL = 300  # seconds
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/138.0.0.0 Safari/537.36"
)


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
    """Launch headless browser, load SRM login page, screenshot CAPTCHA."""
    await _sweep_expired()

    netid = username.split("@")[0] if "@" in username else username
    print(f"[SP-LOGIN-INIT] Starting browser login for NetID: {netid}")

    pw = await _get_playwright()
    browser = await pw.chromium.launch(headless=True)
    context = await browser.new_context(user_agent=_USER_AGENT)
    page = await context.new_page()

    try:
        print(f"[SP-LOGIN-INIT] Navigating to {settings.sp_login_page_url}")
        await page.goto(settings.sp_login_page_url, wait_until="networkidle", timeout=30000)
        print(f"[SP-LOGIN-INIT] Page loaded, URL: {page.url}")

        captcha_img = page.locator("img#secure_captcha")
        try:
            await captcha_img.wait_for(state="visible", timeout=10000)
            print("[SP-LOGIN-INIT] CAPTCHA image found")
        except Exception:
            print("[SP-LOGIN-INIT] CAPTCHA image not found, trying data-src img")
            captcha_img = page.locator("img[data-src*='aptcha'], img[src*='aptcha']").first
            try:
                await captcha_img.wait_for(state="visible", timeout=5000)
                print("[SP-LOGIN-INIT] Fallback CAPTCHA image found")
            except Exception:
                print("[SP-LOGIN-INIT] No CAPTCHA image found, screenshotting full page")
                captcha_img = None

        img_bytes = await (captcha_img.screenshot() if captcha_img else page.screenshot())
        captcha_b64 = base64.b64encode(img_bytes).decode()
        print(f"[SP-LOGIN-INIT] CAPTCHA screenshot: {len(captcha_b64)} chars")

        session_id = uuid.uuid4().hex
        _sessions[session_id] = _BrowserSession(browser=browser, context=context, page=page)
        print(f"[SP-LOGIN-INIT] Session {session_id} stored, browser kept alive")
        return {"success": True, "session_id": session_id, "captcha_image_base64": captcha_b64}

    except Exception as e:
        print(f"[SP-LOGIN-INIT] Error: {e}")
        for closer in (page.close, context.close, browser.close):
            try:
                await closer()
            except Exception:
                pass
        raise


async def finish_login(session_id: str, username: str, password: str, captcha_answer: str) -> LoginResponse:
    """Resume the live browser session, type form like a human, submit, extract cookies."""
    session = _sessions.pop(session_id, None)
    if session is None:
        return LoginResponse(success=False, status=400, message="Session expired or invalid. Restart login.")
    if time.time() - session.created_at > _SESSION_TTL:
        await _close_session(session_id)
        return LoginResponse(success=False, status=400, message="Session expired. Restart login.")

    page = session.page
    context = session.context
    browser = session.browser
    netid = username.split("@")[0] if "@" in username else username

    print(f"[SP-LOGIN-VERIFY] Resuming for NetID: {netid}, session {session_id}")

    try:
        username_input = page.locator("input[name='username'], input[id='username'], input[type='text']").first
        await username_input.click()
        await username_input.type(netid, delay=80)
        await username_input.dispatch_event("blur")
        print(f"[SP-LOGIN-VERIFY] Typed username: {netid}")

        password_input = page.locator("input[name='password'], input[id='password'], input[type='password']").first
        await password_input.click()
        await password_input.type(password, delay=80)
        await password_input.dispatch_event("blur")
        print("[SP-LOGIN-VERIFY] Typed password")

        captcha_input = page.locator("input[name='captcha'], input[id='captcha']").first
        await captcha_input.click()
        await captcha_input.type(captcha_answer, delay=80)
        await captcha_input.dispatch_event("blur")
        print(f"[SP-LOGIN-VERIFY] Typed captcha: {captcha_answer}")

        await page.wait_for_timeout(600)

        submit_btn = page.locator(
            "button[type='submit'], "
            "input[type='submit'], "
            "#login_form button, "
            "#login_form input[type='submit'], "
            "button:has-text('Login'), "
            "button:has-text('Sign In'), "
            "button:has-text('Log In')"
        ).first
        print("[SP-LOGIN-VERIFY] Clicking submit...")

        async with page.expect_navigation(timeout=15000, wait_until="networkidle"):
            await submit_btn.click()

        final_url = page.url
        print(f"[SP-LOGIN-VERIFY] Final URL: {final_url}")

        resp_html = (await page.content()).lower()
        is_on_login_page = "youlogin" in final_url.lower() or (
            "login" in final_url.lower() and "template" not in final_url.lower()
        )
        has_login_form = 'id="login_form"' in resp_html

        if is_on_login_page and has_login_form:
            error_msg = "Login failed"
            if "invalid" in resp_html and ("password" in resp_html or "netid" in resp_html):
                error_msg = "Invalid NetID or password"
            elif "captcha" in resp_html and ("mismatch" in resp_html or "invalid" in resp_html):
                error_msg = "CAPTCHA verification failed"
            elif "too many" in resp_html:
                error_msg = "Too many login attempts"

            print(f"[SP-LOGIN-VERIFY] Login failed: {error_msg}")

            # --- Diagnostics: screenshot + error elements + page snippet ---
            try:
                ss_bytes = await page.screenshot(full_page=True)
                debug_ss = base64.b64encode(ss_bytes).decode()
                print(f"[SP-LOGIN-VERIFY] Debug screenshot captured: {len(debug_ss)} chars")
            except Exception as ss_err:
                print(f"[SP-LOGIN-VERIFY] Screenshot failed: {ss_err}")
                debug_ss = None

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

            # Log a larger slice of page content around the form
            try:
                full_html = await page.content()
                form_idx = full_html.lower().find("login_form")
                if form_idx >= 0:
                    start = max(0, form_idx - 2500)
                    end = min(len(full_html), form_idx + 2500)
                    print(f"[SP-LOGIN-VERIFY] Page HTML around login_form ({start}-{end}):\n{full_html[start:end]}")
                else:
                    print(f"[SP-LOGIN-VERIFY] Full page HTML (first 5000 chars):\n{full_html[:5000]}")
            except Exception as html_err:
                print(f"[SP-LOGIN-VERBOSE] HTML extraction failed: {html_err}")

            return LoginResponse(
                success=False,
                status=401,
                message=error_msg,
                debug_screenshot_base64=debug_ss,
                debug_errors=debug_errors or None,
            )

        cookies = await context.cookies()
        cookie_header = "; ".join(f"{c['name']}={c['value']}" for c in cookies)
        print(f"[SP-LOGIN-VERIFY] Extracted {len(cookies)} cookies, header length: {len(cookie_header)}")

        if not cookie_header:
            return LoginResponse(success=False, status=401, message="No session cookies established")

        print("[SP-LOGIN-VERIFY] Success!")
        return LoginResponse(success=True, status=200, message="Success", cookies=cookie_header)

    except Exception as e:
        print(f"[SP-LOGIN-VERIFY] Error: {e}")

        debug_ss = None
        try:
            ss_bytes = await page.screenshot(full_page=True)
            debug_ss = base64.b64encode(ss_bytes).decode()
            print(f"[SP-LOGIN-VERIFY] Error screenshot captured: {len(debug_ss)} chars")
        except Exception:
            pass

        return LoginResponse(
            success=False,
            status=500,
            message=f"Login error: {e}",
            debug_screenshot_base64=debug_ss,
        )

    finally:
        for closer in (page.close, context.close, browser.close):
            try:
                await closer()
            except Exception:
                pass
        print(f"[SP-LOGIN-VERIFY] Browser closed for session {session_id}")
