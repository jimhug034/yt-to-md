import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// List of Invidious instances to try (open-source YouTube frontends)
const INVIDIOUS_INSTANCES = [
  'https://vid.puffyan.us',
  'https://invidious.snopyta.org',
  'https://invidious.kavin.rocks',
  'https://yewtu.be',
  'https://invidious.namazso.eu',
];

/**
 * API Route to fetch YouTube subtitle data
 * Uses Invidious instances as a proxy to avoid CORS and blocking issues
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const videoId = searchParams.get('videoId');
  const type = searchParams.get('type') || 'list';
  const lang = searchParams.get('lang');

  if (!videoId) {
    return NextResponse.json({ error: 'videoId is required' }, { status: 400 });
  }

  // For list type: get available languages
  if (type === 'list') {
    return await getAvailableLanguages(videoId);
  }

  // For subtitle content: get actual subtitles
  if (lang) {
    return await getSubtitleContent(videoId, lang);
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}

/**
 * Get available subtitle languages using Invidious API
 */
async function getAvailableLanguages(videoId: string): Promise<NextResponse> {
  // Try each Invidious instance
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const apiUrl = `${instance}/api/v1/videos/${videoId}?fields=captions`;

      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        console.warn(`${instance} returned ${response.status}`);
        continue;
      }

      const data = await response.json();

      if (!data.captions || !Array.isArray(data.captions)) {
        console.warn(`${instance} returned no captions`);
        continue;
      }

      // Build XML response similar to YouTube timedtext API
      let xml = '<?xml version="1.0" encoding="utf-8"?><transcript>';

      for (const caption of data.captions) {
        const langCode = caption.languageCode || caption.code || 'en';
        const langName = caption.label || caption.languageName || caption.languageCode || 'Unknown';
        const isAuto = caption.label?.toLowerCase().includes('auto') || false;

        xml += `<track lang_code="${langCode}" lang_name="${langName}" lang_translit="" lang_original=""${isAuto ? ' kind="asr"' : ''}/>`;
      }

      xml += '</transcript>';

      return new NextResponse(xml, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error) {
      console.warn(`${instance} failed:`, error instanceof Error ? error.message : String(error));
      continue;
    }
  }

  // All instances failed, return fallback
  console.error('All Invidious instances failed');
  return generateFallbackResponse();
}

/**
 * Get subtitle content using Invidious API
 */
async function getSubtitleContent(videoId: string, langCode: string): Promise<NextResponse> {
  // Try each Invidious instance
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      // First get the video info to find the caption URL
      const apiUrl = `${instance}/api/v1/videos/${videoId}?fields=captions`;

      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        continue;
      }

      const data = await response.json();

      if (!data.captions || !Array.isArray(data.captions)) {
        continue;
      }

      // Find the matching caption
      const caption = data.captions.find((c: any) =>
        c.languageCode === langCode || c.code === langCode
      );

      if (!caption || !caption.url) {
        continue;
      }

      // Fetch the actual subtitle content
      const subtitleResponse = await fetch(`${instance}${caption.url}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!subtitleResponse.ok) {
        continue;
      }

      // Invidious returns JSON format, convert to XML
      const subtitleData = await subtitleResponse.json();
      const xml = convertInvidiousSubtitlesToXml(subtitleData);

      return new NextResponse(xml, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error) {
      console.warn(`${instance} failed:`, error instanceof Error ? error.message : String(error));
      continue;
    }
  }

  return NextResponse.json(
    {
      error: 'Failed to fetch subtitle content from all sources',
      hint: 'The video may not have subtitles for the selected language.',
    },
    { status: 500 }
  );
}

/**
 * Convert Invidious subtitle format (JSON) to YouTube XML format
 */
function convertInvidiousSubtitlesToXml(subtitles: any): string {
  if (!subtitles || !Array.isArray(subtitles)) {
    return '<?xml version="1.0" encoding="utf-8"?><transcript></transcript>';
  }

  let xml = '<?xml version="1.0" encoding="utf-8"?><transcript>';

  for (const sub of subtitles) {
    if (sub.content) {
      const start = sub.start || 0;
      const dur = sub.end ? sub.end - start : 2;
      const text = escapeXml(sub.content);
      xml += `<text start="${start}" dur="${dur}">${text}</text>`;
    }
  }

  xml += '</transcript>';
  return xml;
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate fallback response with common languages
 */
function generateFallbackResponse(): NextResponse {
  const xml = `<?xml version="1.0" encoding="utf-8"?><transcript>
    <track lang_code="en" lang_name="English" lang_translit="" lang_original=""/>
  </transcript>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * OPTIONS handler for CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
