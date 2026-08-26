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

    // Try /api/auth/login/ first
    let response = await fetch('https://campusapi.fly.dev/api/auth/login/', {
      method: 'POST',
      headers,
      body: JSON.stringify({ username, password }),
    });

    let resText = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(resText);
    } catch {
      data = { message: resText };
    }

    // Fallback to /api/student-portal/login if needed
    if (!response.ok && data.message?.includes('Invalid request body')) {
      response = await fetch('https://campusapi.fly.dev/api/student-portal/login', {
        method: 'POST',
        headers,
        body: JSON.stringify({ net_id: cleanNetId, password }),
      });
      resText = await response.text();
      try {
        data = JSON.parse(resText);
      } catch {
        data = { message: resText };
      }
    }

    if (!response.ok || data.status === 'fail' || data.status === 'error') {
      return NextResponse.json(
        { success: false, message: data.message || data.Message || 'Login failed — check your Net ID and password' },
        { status: response.status || 400 }
      );
    }

    // Extract CSRF token from headers or data
    const csrfToken =
      data.cookies ||
      data.token ||
      data.Cookies ||
      data.COOKIE ||
      data.cookie ||
      data['X-CSRF-Token'] ||
      response.headers.get('x-csrf-token') ||
      response.headers.get('set-cookie');

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
