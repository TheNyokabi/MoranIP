import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000';

function buildUpstreamUrl(req: NextRequest, pathParts: string[]): string {
  const upstreamPath = `/${pathParts.join('/')}`;
  const url = new URL(API_BASE_URL);
  // Preserve query string
  const reqUrl = new URL(req.url);
  url.pathname = upstreamPath;
  url.search = reqUrl.search;
  return url.toString();
}

async function proxy(req: NextRequest, params: { path: string[] }) {
  try {
    const { path } = params;
    const upstreamUrl = buildUpstreamUrl(req, path);

    const headers = new Headers(req.headers);

    // Ensure Authorization header is present if auth_token cookie exists.
    if (!headers.get('authorization')) {
      const cookieToken = req.cookies.get('auth_token')?.value;
      if (cookieToken) headers.set('authorization', `Bearer ${cookieToken}`);
    }

    // Next adds host-specific headers that can confuse upstream.
    headers.delete('host');
    // Prevent undici RequestContentLengthMismatchError when clients (e.g. curl)
    // send Content-Length headers that don't match the forwarded body.
    headers.delete('content-length');
    headers.delete('transfer-encoding');

    // Read body once so we can safely retry on 404 without re-consuming the stream.
    const hasBody = !(req.method === 'GET' || req.method === 'HEAD');
    const bodyBytes = hasBody ? Buffer.from(await req.arrayBuffer()) : undefined;

    const forwardOnce = (url: string) =>
      fetch(url, {
        method: req.method,
        headers: new Headers(headers),
        body: bodyBytes,
        redirect: 'manual',
      });

    // Many backend routers in this repo are mounted under `/api/*`, but some core
    // endpoints are mounted at the root (e.g. `/health`, `/auth/*`).
    // We optimistically try the direct path first, and on 404 we retry with a
    // leading `/api/` to cover the mounted routers.
    let upstreamRes;
    try {
      upstreamRes = await forwardOnce(upstreamUrl);
      if (upstreamRes.status === 404) {
        const retryUrl = buildUpstreamUrl(req, ['api', ...path]);
        upstreamRes = await forwardOnce(retryUrl);
      }
    } catch (fetchError: any) {
      console.error('Failed to fetch from upstream:', fetchError);
      return NextResponse.json(
        {
          detail: `Failed to connect to backend: ${fetchError.message || 'Connection error'}`,
          error: 'UPSTREAM_CONNECTION_ERROR',
          upstream_url: upstreamUrl,
        },
        { status: 502 }
      );
    }

    // Pass through response. Avoid forwarding hop-by-hop headers.
    const resHeaders = new Headers(upstreamRes.headers);
    resHeaders.delete('transfer-encoding');
    resHeaders.delete('content-encoding');
    resHeaders.delete('content-length'); // Let Next.js recalculate Content-Length

    // No-content responses must not include a body.
    if (upstreamRes.status === 204 || upstreamRes.status === 205 || upstreamRes.status === 304) {
      return new NextResponse(null, { status: upstreamRes.status, headers: resHeaders });
    }

    const contentType = upstreamRes.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        // Read the full response body first
        const text = await upstreamRes.text();
        if (!text || text.trim() === '') {
          return NextResponse.json(null, { status: upstreamRes.status, headers: resHeaders });
        }
        const json = JSON.parse(text);
        // NextResponse.json will automatically set correct Content-Length
        return NextResponse.json(json, { status: upstreamRes.status, headers: resHeaders });
      } catch (e) {
        // If JSON parsing fails, return error response
        console.error('Failed to parse upstream JSON response:', e);
        return NextResponse.json(
          { detail: 'Invalid JSON response from upstream' },
          { status: 502, headers: resHeaders }
        );
      }
    }

    const bytes = await upstreamRes.arrayBuffer();
    // NextResponse will automatically set correct Content-Length for ArrayBuffer
    return new NextResponse(Buffer.from(bytes), { status: upstreamRes.status, headers: resHeaders });
  } catch (error: any) {
    console.error('API proxy error:', error);
    return NextResponse.json(
      {
        detail: error.message || 'Internal server error in API proxy',
        error: 'PROXY_ERROR',
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params);
}
export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params);
}
export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params);
}
export async function PATCH(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params);
}
export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params);
}
