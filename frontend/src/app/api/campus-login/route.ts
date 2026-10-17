import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Both Campus Web upstreams are third-party and occasionally stall. Every
// upstream call is bounded by this timeout so a hung upstream can never
// leave the login button spinning forever.
const UPSTREAM_TIMEOUT_MS = 9000;

const CAMPUS_API = 'https://campusapi.fly.dev';

export async function GET() {
  return NextResponse.json({ message: 'Campus Web Login Proxy' });
}

// The auth endpoint returns an Academia/IAM session as a cookie string in
// `Cookies` (e.g. "_iamadt_client_1000…=…"); `sessionToken` is its fallback.
function extractAcademiaToken(data: any): string | null {
  if (!data || typeof data !== 'object') return null;
  return (
    (typeof data.Cookies === 'string' && data.Cookies.trim()) ||
    (typeof data.sessionToken === 'string' && data.sessionToken.trim()) ||
    null
  );
}

interface UpstreamResult {
  source: 'portal' | 'auth';
  ok: boolean;
  status: number;
  data: any;
  spSession: string | null;
}

async function callUpstream(
  path: string,
  body: Record<string, string>,
  headers: Record<string, string>,
  source: UpstreamResult['source'],
): Promise<UpstreamResult> {
  let res: Response;
  try {
    res = await fetch(`${CAMPUS_API}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    return {
      source,
      ok: false,
      status: timedOut ? 504 : 502,
      data: {
        message: timedOut
          ? 'Campus Web took too long to respond — please try again.'
          : 'Could not reach Campus Web — please try again.',
      },
      spSession: null,
    };
  }

  const text = await res.text();
  let data: any = {};
  try { data = JSON.parse(text); } catch { data = { message: text.slice(0, 300) }; }

  // The Student Portal login puts the token in Set-Cookie, not in the body.
  // Use getSetCookie() (Node) with a header fallback for other runtimes.
  let spSession: string | null = null;
  const setCookies: string[] = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : (res.headers.get('set-cookie') || '').split(',').map(s => s.trim()).filter(Boolean);
  for (const sc of setCookies) {
    const match = sc.match(/sp_session=([^;]+)/);
    if (match) {
      // Format as cookie pair so backend _build_client can parse it
      spSession = `sp_session=${match[1]}`;
      break;
    }
  }

  const failed = data?.status === 'fail' || data?.status === 'error';
  return { source, ok: res.ok && !failed, status: res.status, data, spSession };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { net_id, password } = body;

    if (!net_id || !password) {
      return NextResponse.json({ success: false, message: 'Net ID and password are required' }, { status: 400 });
    }

    const cleanNetId = String(net_id).split('@')[0].trim();
    const username = net_id.includes('@') ? net_id : `${cleanNetId}@srmist.edu.in`;

    const headers = {
      'Content-Type': 'application/json',
      'Origin': 'https://campusweb.in',
      'Referer': 'https://campusweb.in/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    };

    // Student Portal first: it is the one that returns the `sp_session` every
    // other Campus Web call in this app needs. It is started together with
    // the auth endpoint (so both make progress) but we only wait on auth if
    // the portal call fails — that keeps the happy path at portal latency
    // instead of "whichever upstream is slowest".
    const authPromise = callUpstream(
      '/api/auth/login/',
      { username, password },
      headers,
      'auth',
    );

    const portal = await callUpstream(
      '/api/student-portal/login',
      { net_id: cleanNetId, password },
      headers,
      'portal',
    );

    const result = portal.ok ? portal : await authPromise;

    // The auth endpoint also yields an Academia (IAM) session token. That is
    // the ONLY token under which /api/auth/user/ returns the component-wise
    // `tests` breakdown (FT-I, FT-II, …) and /api/auth/planner works — the
    // sp_session alone gives empty `tests` and a 401 planner. So always hand
    // it back alongside the portal token.
    const authResult = await authPromise;
    const academiaToken = authResult.ok ? extractAcademiaToken(authResult.data) : null;

    if (!result.ok) {
      const message =
        (portal.data && (portal.data.message || portal.data.Message)) ||
        (result.data && (result.data.message || result.data.Message)) ||
        'Login failed — check your Net ID and password';
      const status = portal.status || result.status || 400;
      return NextResponse.json({ success: false, message }, { status: status >= 400 ? status : 400 });
    }

    const { data } = result;

    // Extract token — prefer sp_session from the portal's Set-Cookie header,
    // fall back to body fields (auth/login returns `Cookies` in the body).
    const csrfToken =
      result.spSession ||
      data.cookies ||
      data.token ||
      data.Cookies ||
      data.COOKIE ||
      data.cookie ||
      data['X-CSRF-Token'] ||
      data.sp_session;

    if (!csrfToken) {
      return NextResponse.json(
        { success: false, message: 'Login failed — session token not received. Check your credentials.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      cookies: csrfToken,
      token: csrfToken,
      // Academia (IAM) session from /api/auth/login/ — needed for component-wise
      // marks and the day-order planner. Null when the auth upstream failed.
      academiaToken,
      data,
    });
  } catch (error) {
    console.error('Campus Web proxy error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Server proxy error' },
      { status: 500 }
    );
  }
}
