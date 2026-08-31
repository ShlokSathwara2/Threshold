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
    const parseResponse = async (res: Response) => {
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch { data = { message: text }; }
      return { ok: res.ok, status: res.status, data };
    };

    const endpoint1 = fetch('https://campusapi.fly.dev/api/auth/login/', {
      method: 'POST',
      headers,
      body: JSON.stringify({ username, password }),
    }).then(async (res) => ({ source: 'auth', ...(await parseResponse(res)) }));

    const endpoint2 = fetch('https://campusapi.fly.dev/api/student-portal/login', {
      method: 'POST',
      headers,
      body: JSON.stringify({ net_id: cleanNetId, password }),
    }).then(async (res) => ({ source: 'portal', ...(await parseResponse(res)) }));

    const results = await Promise.allSettled([endpoint1, endpoint2]);

    // Pick the first successful result
    let result: { ok: boolean; status: number; data: any; source: string } | null = null;
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.ok && r.value.data.status !== 'fail' && r.value.data.status !== 'error') {
        result = r.value;
        break;
      }
    }

    // If neither succeeded, use the first one for error message
    if (!result) {
      const first = results[0];
      if (first.status === 'fulfilled') {
        result = first.value;
      } else if (results[1].status === 'fulfilled') {
        result = results[1].value;
      } else {
        return NextResponse.json(
          { success: false, message: 'Failed to connect to Campus Web' },
          { status: 502 }
        );
      }
    }

    const { data } = result;

    if (!result.ok || data.status === 'fail' || data.status === 'error') {
      return NextResponse.json(
        { success: false, message: data.message || data.Message || 'Login failed — check your Net ID and password' },
        { status: result.status || 400 }
      );
    }

    // Extract token from various possible response shapes
    const csrfToken =
      data.cookies ||
      data.token ||
      data.Cookies ||
      data.COOKIE ||
      data.cookie ||
      data['X-CSRF-Token'] ||
      data.sp_session ||
      (typeof result.source === 'string' && result.source === 'portal' ? data.sp_session : null);

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
