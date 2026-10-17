import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Only these Campus Web paths may be reached through this proxy. Without an
// allowlist the `endpoint` parameter turns the route into an open proxy to
// any URL (it previously accepted absolute `http(s)://…` targets).
const ALLOWED_ENDPOINTS: RegExp[] = [
  /^\/api\/auth\/user\/?$/,
  /^\/api\/auth\/timetable\/[^/]+$/,
  /^\/api\/auth\/planner\/?$/,
  /^\/api\/student-portal\/attendance$/,
];

function resolveEndpoint(endpoint: string | null): string | null {
  if (!endpoint || endpoint.startsWith('http')) return null;
  return ALLOWED_ENDPOINTS.some((re) => re.test(endpoint))
    ? `https://campusapi.fly.dev${endpoint}`
    : null;
}

// Timeout → a clear 504 instead of a generic 500 ("Server proxy error").
function upstreamErrorResponse(error: unknown, label: string): NextResponse {
  const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
  if (timedOut) {
    return NextResponse.json(
      { success: false, message: 'Campus Web took too long to respond — pull down to refresh and try again.' },
      { status: 504 }
    );
  }
  console.error(`Campus Web proxy ${label} error:`, error);
  return NextResponse.json(
    { success: false, message: error instanceof Error ? error.message : 'Server proxy error' },
    { status: 500 }
  );
}

// Shared upstream headers. `X-Academia-Token` must be forwarded: endpoints
// such as /api/auth/planner require an Academia session, which the Net ID
// (Campus Web) login alone does not provide.
function buildUpstreamHeaders(req: Request): Record<string, string> {
  const csrfToken = req.headers.get('x-csrf-token') || '';
  const netId = req.headers.get('x-net-id') || '';
  const academiaToken = req.headers.get('x-academia-token') || '';

  const headers: Record<string, string> = {
    'Origin': 'https://campusweb.in',
    'Referer': 'https://campusweb.in/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  };

  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
    if (csrfToken.includes('=')) headers['Cookie'] = csrfToken;
  }
  if (netId) headers['X-Net-ID'] = netId;
  if (academiaToken) headers['X-Academia-Token'] = academiaToken;

  return headers;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const endpoint = searchParams.get('endpoint');

    if (!endpoint) {
      return NextResponse.json({ success: false, message: 'endpoint parameter required' }, { status: 400 });
    }

    const targetUrl = resolveEndpoint(endpoint);
    if (!targetUrl) {
      return NextResponse.json({ success: false, message: 'endpoint not allowed' }, { status: 403 });
    }

    const headers = buildUpstreamHeaders(req);
    console.log('[Proxy GET]', targetUrl, { netId: req.headers.get('x-net-id') });

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    });

    const rawText = await response.text();
    console.log('[Proxy GET] status:', response.status, 'body:', rawText.substring(0, 500));
    let data: any = {};
    try { data = JSON.parse(rawText); } catch { data = { raw: rawText }; }

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: data.message || `Campus Web returned status ${response.status}` },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return upstreamErrorResponse(error, 'GET');
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
    const targetUrl = resolveEndpoint(endpoint);
    if (!targetUrl) {
      return NextResponse.json({ success: false, message: 'endpoint not allowed' }, { status: 403 });
    }

    const headers = { 'Content-Type': 'application/json', ...buildUpstreamHeaders(req) };
    console.log('[Proxy POST]', targetUrl, { netId: req.headers.get('x-net-id') });

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });

    const rawText = await response.text();
    console.log('[Proxy POST] status:', response.status, 'body:', rawText.substring(0, 500));
    let data: any = {};
    try { data = JSON.parse(rawText); } catch { data = { raw: rawText }; }

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: data.message || `Campus Web returned status ${response.status}` },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return upstreamErrorResponse(error, 'POST');
  }
}
