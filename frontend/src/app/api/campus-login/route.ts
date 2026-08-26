import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { net_id, password } = body;

    if (!net_id || !password) {
      return NextResponse.json({ success: false, message: 'Net ID and password are required' }, { status: 400 });
    }

    const cleanNetId = String(net_id).split('@')[0].trim();

    const response = await fetch('https://campusapi.fly.dev/api/student-portal/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://campusweb.in',
        'Referer': 'https://campusweb.in/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({ net_id: cleanNetId, password }),
    });

    const resText = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(resText);
    } catch {
      data = { message: resText };
    }

    if (!response.ok || data.status === 'fail' || data.status === 'error') {
      return NextResponse.json(
        { success: false, message: data.message || data.Message || 'Login failed — check your Net ID and password' },
        { status: response.status || 400 }
      );
    }

    // Extract CSRF token from headers or data
    const csrfToken = response.headers.get('x-csrf-token') || data.token || data.cookies || data['X-CSRF-Token'] || cleanNetId;

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
