import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ message: 'Campus Web Login Proxy' });
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

    // Race both endpoints — use whichever responds first with success
    const parseResponseWithCookies = async (res: Response) => {
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch { data = { message: text }; }
      // Extract sp_session from Set-Cookie header (Student Portal login puts token here, not in body)
      // Use getSetCookie() (Node.js array) or get('set-cookie') fallback
      let spSession: string | null = null;
      const cookies: string[] = typeof res.headers.getSetCookie === 'function'
        ? res.headers.getSetCookie()
        : (res.headers.get('set-cookie') || '').split(',').map(s => s.trim()).filter(Boolean);
      for (const sc of cookies) {
        const match = sc.match(/sp_session=([^;]+)/);
        if (match) {
          // Format as cookie pair so backend _build_client can parse it
          spSession = `sp_session=${match[1]}`;
          break;
        }
      }
      return { ok: res.ok, status: res.status, data, spSession };
    };

    const endpoint1 = fetch('https://campusapi.fly.dev/api/auth/login/', {
      method: 'POST',
      headers,
      body: JSON.stringify({ username, password }),
    }).then(async (res) => ({ source: 'auth', ...(await parseResponseWithCookies(res)) }));

    const endpoint2 = fetch('https://campusapi.fly.dev/api/student-portal/login', {
      method: 'POST',
      headers,
      body: JSON.stringify({ net_id: cleanNetId, password }),
    }).then(async (res) => ({ source: 'portal', ...(await parseResponseWithCookies(res)) }));

    const results = await Promise.allSettled([endpoint1, endpoint2]);

    // Collect all successful results
    const successes: Array<{ ok: boolean; status: number; data: any; source: string; spSession: string | null }> = [];
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.ok && r.value.data.status !== 'fail' && r.value.data.status !== 'error') {
        successes.push(r.value);
      }
    }

    if (successes.length === 0) {
      // Use the first result for error message
      const first = results[0];
      if (first.status === 'fulfilled') {
        const d = first.value.data;
        return NextResponse.json(
          { success: false, message: d.message || d.Message || 'Login failed — check your Net ID and password' },
          { status: first.value.status || 400 }
        );
      }
      return NextResponse.json(
        { success: false, message: 'Failed to connect to Campus Web' },
        { status: 502 }
      );
    }

    // Prefer the Student Portal result (has the actual SP session cookie we need)
    const portalResult = successes.find(r => r.source === 'portal');
    const result = portalResult || successes[0];
    const { data } = result;

    // Extract token — prefer sp_session from Set-Cookie header (portal login),
    // fall back to body fields (auth/login returns Cookies in body)
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
        { success: false, message: data.message || 'Login failed — session token not received. Check your credentials.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      cookies: csrfToken,
      token: csrfToken,
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
