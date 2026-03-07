import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// List of Invidious instances to try (open-source YouTube frontends)
// Note: Public instances are often unstable. The app primarily uses client-side scraping.
// Reduced list and shorter timeout to prevent long waits when instances are unavailable.
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://yewtu.be',
  'https://invidious.nerdvpn.de',
];

// Timeout for each Invidious request (reduced from 15s to 5s for faster fallback)
const REQUEST_TIMEOUT = 5000;

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
 * Includes retry logic for failed requests
 */
async function getAvailableLanguages(videoId: string): Promise<NextResponse> {
  // Try each Invidious instance (no retry for faster fallback)
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const apiUrl = `${instance}/api/v1/videos/${videoId}?fields=captions`;

      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      });

      if (!response.ok) {
        console.warn(`[Invidious] ${instance} returned ${response.status}`);
        continue; // Try next instance
      }

      const data = await response.json();

      if (!data.captions || !Array.isArray(data.captions)) {
        console.warn(`[Invidious] ${instance} returned no captions`);
        continue; // Try next instance
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

      console.log(`[Invidious] Successfully fetched captions from ${instance} (${data.captions.length} tracks)`);
      return new NextResponse(xml, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`[Invidious] ${instance} failed: ${errorMsg}`);
      // Continue to next instance
    }
  }

  // All instances failed, return fallback
  console.error('[Invidious] All instances failed, using fallback language list');
  return generateFallbackResponse();
}

/**
 * Get subtitle content using Invidious API
 * Includes retry logic for failed requests
 */
async function getSubtitleContent(videoId: string, langCode: string): Promise<NextResponse> {
  // Try each Invidious instance (no retry for faster fallback)
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      // First get the video info to find the caption URL
      const apiUrl = `${instance}/api/v1/videos/${videoId}?fields=captions`;

      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      });

      if (!response.ok) {
        continue; // Try next instance
      }

      const data = await response.json();

      if (!data.captions || !Array.isArray(data.captions)) {
        continue; // Try next instance
      }

      // Find the matching caption
      const caption = data.captions.find((c: any) =>
        c.languageCode === langCode || c.code === langCode
      );

      if (!caption || !caption.url) {
        continue; // Try next instance
      }

      // Fetch the actual subtitle content
      const subtitleResponse = await fetch(`${instance}${caption.url}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      });

      if (!subtitleResponse.ok) {
        continue; // Try next instance
      }

      // Invidious returns JSON format, convert to XML
      const subtitleData = await subtitleResponse.json();
      const xml = convertInvidiousSubtitlesToXml(subtitleData);

      console.log(`[Invidious] Successfully fetched subtitle content from ${instance} for ${langCode}`);
      return new NextResponse(xml, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`[Invidious] ${instance} failed for ${langCode}: ${errorMsg}`);
      // Continue to next instance
    }
  }

  console.error(`[Invidious] All instances failed to fetch subtitle content for ${langCode}`);
  return NextResponse.json(
    {
      error: 'Failed to fetch subtitle content from all sources',
      hint: 'The video may not have subtitles for the selected language. Please try again later.',
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
 * Used when all Invidious instances fail
 */
function generateFallbackResponse(): NextResponse {
  const commonLanguages = [
    { code: 'en', name: 'English' },
    { code: 'zh', name: 'Chinese' },
    { code: 'zh-Hans', name: 'Chinese (Simplified)' },
    { code: 'zh-Hant', name: 'Chinese (Traditional)' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'it', name: 'Italian' },
    { code: 'ar', name: 'Arabic' },
    { code: 'hi', name: 'Hindi' },
    { code: 'th', name: 'Thai' },
    { code: 'vi', name: 'Vietnamese' },
    { code: 'id', name: 'Indonesian' },
    { code: 'tr', name: 'Turkish' },
    { code: 'pl', name: 'Polish' },
    { code: 'nl', name: 'Dutch' },
  ];

  let xml = '<?xml version="1.0" encoding="utf-8"?><transcript>';
  for (const lang of commonLanguages) {
    xml += `<track lang_code="${lang.code}" lang_name="${lang.name}" lang_translit="" lang_original=""/>`;
  }
  xml += '</transcript>';

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
