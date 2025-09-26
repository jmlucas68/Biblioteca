import { NextResponse } from 'next/server';

// Simple proxy to fetch public Google Drive files with CORS enabled
// Usage: /api/drive-proxy?id=<FILE_ID> or /api/drive-proxy?url=<drive_url>

function extractDriveId(inputUrl: string | null): string | null {
  if (!inputUrl) return null;
  const byParam = inputUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (byParam && byParam[1]) return byParam[1];
  const byPath = inputUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)\//);
  if (byPath && byPath[1]) return byPath[1];
  return null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const url = searchParams.get('url');
    const driveId = id || extractDriveId(url);
    if (!driveId) {
      return new NextResponse('Missing Google Drive file id or url', { status: 400 });
    }

    const downloadUrl = `https://drive.google.com/uc?export=download&id=${driveId}`;

    // Fetch from Drive
    const driveRes = await fetch(downloadUrl, {
      // Do not forward cookies; public files should be accessible
      redirect: 'follow',
    });

    if (!driveRes.ok) {
      return new NextResponse(`Upstream error: ${driveRes.status}`, { status: 502 });
    }

    // Stream the body through with permissive CORS headers
    const headers = new Headers(driveRes.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Range');
    // Ensure a generic binary content type if Drive sends html
    if (!headers.get('content-type') || headers.get('content-type')?.includes('text/html')) {
      headers.set('Content-Type', 'application/epub+zip');
    }
    // Allow range requests for better epub.js performance
    if (!headers.get('accept-ranges')) {
      headers.set('Accept-Ranges', 'bytes');
    }

    return new NextResponse(driveRes.body, { status: 200, headers });
  } catch (err) {
    return new NextResponse('Proxy error', { status: 500 });
  }
}

export async function OPTIONS() {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Range');
  return new NextResponse(null, { status: 204, headers });
}


