import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const endpoint = searchParams.get('endpoint');

    if (!endpoint) {
      return NextResponse.json({ success: false, message: 'endpoint parameter required' }, { status: 400 });
    }

    const csrfToken = req.headers.get('x-csrf-token') || '';
    const netId = req.headers.get('x-net-id') || '';

    const headers: Record<string, string> = {
      'Origin': 'https://campusweb.in',
      'Referer': 'https://campusweb.in/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    };

    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    if (netId) headers['X-Net-ID'] = netId;

    const targetUrl = endpoint.startsWith('http') ? endpoint : `https://campusapi.fly.dev${endpoint}`;

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: data.message || `Campus Web returned status ${response.status}` },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Campus Web proxy GET error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Server proxy error' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const endpoint = searchParams.get('endpoint');

    if (!endpoint) {
      return NextResponse.json({ success: false, message: 'endpoint parameter required' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const csrfToken = req.headers.get('x-csrf-token') || '';
    const netId = req.headers.get('x-net-id') || '';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Origin': 'https://campusweb.in',
      'Referer': 'https://campusweb.in/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    };

    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    if (netId) headers['X-Net-ID'] = netId;

    const targetUrl = endpoint.startsWith('http') ? endpoint : `https://campusapi.fly.dev${endpoint}`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: data.message || `Campus Web returned status ${response.status}` },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Campus Web proxy POST error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Server proxy error' },
      { status: 500 }
    );
  }
}
