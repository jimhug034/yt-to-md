#!/usr/bin/env node

/**
 * Automated test script for YouTube Subtitle to Markdown
 */

const https = require('https');

// Test video: Andrej Karpathy's "Deep Dive into LLMs like ChatGPT"
const TEST_VIDEO_ID = '7xTGNNLPyMI';
const TEST_VIDEO_URL = `https://www.youtube.com/watch?v=${TEST_VIDEO_ID}`;

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✓ ${message}`, 'green');
}

function error(message) {
  log(`✗ ${message}`, 'red');
}

function info(message) {
  log(`→ ${message}`, 'blue');
}

function warn(message) {
  log(`⚠ ${message}`, 'yellow');
}

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const opts = {
      ...options,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...options.headers,
      },
    };

    const req = https.request(urlObj, opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          text: () => Promise.resolve(data),
          json: () => Promise.resolve(JSON.parse(data)),
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

// Test 1: Video ID extraction
function testVideoIdExtraction() {
  log('\n=== Test 1: Video ID Extraction ===', 'blue');

  const patterns = [
    'https://www.youtube.com/watch?v=7xTGNNLPyMI',
    'https://youtu.be/7xTGNNLPyMI',
    'https://www.youtube.com/embed/7xTGNNLPyMI',
    '7xTGNNLPyMI',
  ];

  const testPatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  let passed = 0;

  for (const input of patterns) {
    let extracted = null;
    for (const pattern of testPatterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        extracted = match[1];
        break;
      }
    }

    if (extracted === TEST_VIDEO_ID) {
      success(`Extracted "${TEST_VIDEO_ID}" from: ${input}`);
      passed++;
    } else {
      error(`Failed to extract from: ${input}`);
    }
  }

  return passed === patterns.length;
}

// Test 2: Video info from noembed.com
async function testVideoInfo() {
  log('\n=== Test 2: Video Info (noembed.com) ===', 'blue');

  try {
    const url = `https://noembed.com/embed?url=${encodeURIComponent(TEST_VIDEO_URL)}`;
    info(`Fetching: ${url}`);

    const response = await fetch(url);

    if (!response.ok) {
      error(`HTTP ${response.status}`);
      return false;
    }

    const data = await response.json();

    if (data.error) {
      error(`noembed returned error: ${data.error}`);
      return false;
    }

    success(`Got video info`);
    log(`  Title: ${data.title}`, 'reset');
    log(`  Author: ${data.author_name}`, 'reset');
    log(`  Thumbnail: ${data.thumbnail_url ? '✓' : '✗'}`, 'reset');

    return true;
  } catch (e) {
    error(`Failed: ${e.message}`);
    return false;
  }
}

// Test 3: YouTube embed page scraping
async function testEmbedScraping() {
  log('\n=== Test 3: YouTube Embed Scraping ===', 'blue');

  try {
    const embedUrl = `https://www.youtube.com/embed/${TEST_VIDEO_ID}`;
    info(`Fetching: ${embedUrl}`);

    const response = await fetch(embedUrl);

    if (!response.ok) {
      error(`HTTP ${response.status}`);
      return false;
    }

    const html = await response.text();

    // Check for ytInitialPlayerResponse
    const match = html.match(/ytInitialPlayerResponse\s*=\s*({.+?})\s*;var/);

    if (!match) {
      error('Could not find ytInitialPlayerResponse in embed page');
      return false;
    }

    try {
      const playerData = JSON.parse(match[1]);
      const captions = playerData.captions?.playerCaptionsTracklistRenderer?.captionTracks;

      if (!captions || !Array.isArray(captions)) {
        warn('No caption tracks found in player response');
        return false;
      }

      success(`Found ${captions.length} caption tracks:`);

      for (const track of captions.slice(0, 5)) {
        const langCode = track.languageCode || 'unknown';
        const langName = track.name?.simpleText || track.languageCode || 'Unknown';
        const isAuto = track.kind === 'asr';
        log(`  - ${langName} (${langCode})${isAuto ? ' [Auto]' : ''}`, 'reset');
      }

      return true;
    } catch (parseError) {
      error(`Failed to parse player response: ${parseError.message}`);
      return false;
    }
  } catch (e) {
    error(`Failed: ${e.message}`);
    return false;
  }
}

// Test 4: Local API endpoint
async function testLocalAPI() {
  log('\n=== Test 4: Local API Endpoint ===', 'blue');

  const apiUrl = `http://localhost:3000/api/subtitles?videoId=${TEST_VIDEO_ID}&type=list`;
  info(`Testing: ${apiUrl}`);

  try {
    const response = await fetch(apiUrl);

    if (!response.ok) {
      error(`HTTP ${response.status}`);
      return false;
    }

    const text = await response.text();

    if (text.includes('"error"')) {
      warn('API returned error (may be expected due to network restrictions)');
      log(`  Response: ${text.substring(0, 200)}...`, 'reset');
      return false;
    }

    if (text.includes('<transcript>')) {
      const trackMatches = text.match(/<track[^>]*>/g);
      if (trackMatches) {
        success(`API returned ${trackMatches.length} tracks`);
        return true;
      }
    }

    warn('API response unclear');
    return false;
  } catch (e) {
    error(`Failed: ${e.message}`);
    return false;
  }
}

// Test 5: Local app accessibility
async function testLocalApp() {
  log('\n=== Test 5: Local App Accessibility ===', 'blue');

  const appUrl = 'http://localhost:3000';
  info(`Testing: ${appUrl}`);

  try {
    const response = await fetch(appUrl);

    if (!response.ok) {
      error(`HTTP ${response.status}`);
      return false;
    }

    const html = await response.text();

    if (html.includes('YouTube Subtitle to Markdown')) {
      success('App is running and accessible');
      return true;
    }

    error('App response unexpected');
    return false;
  } catch (e) {
    error(`Failed: ${e.message}`);
    return false;
  }
}

// Run all tests
async function runTests() {
  log('\n╔════════════════════════════════════════════════╗', 'blue');
  log('║  YouTube Subtitle to Markdown - Auto Test     ║', 'blue');
  log('╚════════════════════════════════════════════════╝', 'blue');

  const results = {
    videoIdExtraction: testVideoIdExtraction(),
    videoInfo: await testVideoInfo(),
    embedScraping: await testEmbedScraping(),
    localAPI: await testLocalAPI(),
    localApp: await testLocalApp(),
  };

  // Summary
  log('\n=== Summary ===', 'blue');

  let passed = 0;
  let total = 0;

  for (const [name, result] of Object.entries(results)) {
    total++;
    if (result) {
      success(name);
      passed++;
    } else {
      error(name);
    }
  }

  log('\n' + '─'.repeat(50), 'reset');
  log(`Result: ${passed}/${total} tests passed`, passed === total ? 'green' : 'yellow');
  log('─'.repeat(50), 'reset');

  // Browser test reminder
  log('\n=== Browser Test Required ===', 'yellow');
  log('Some features require browser testing:', 'reset');
  log('  Open http://localhost:3000 in your browser', 'reset');
  log(`  Paste: ${TEST_VIDEO_URL}`, 'reset');
  log('  Verify: Video info, language list, subtitle loading', 'reset');
  log('', 'reset');

  process.exit(passed === total ? 0 : 1);
}

runTests().catch(err => {
  error(`Test runner error: ${err.message}`);
  process.exit(1);
});
