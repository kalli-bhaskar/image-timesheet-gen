/**
 * Client-side image analysis using Gemini API directly from the browser.
 *
 * SECURITY NOTE: VITE_GEMINI_API_KEY is bundled into the browser JS.
 * To prevent misuse, restrict this API key to your app's origin/referrer
 * in Google Cloud Console > APIs & Services > Credentials.
 */

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-flash-latest'];

const COUNTY_TAGS = { fairfield: 'LCT', franklin: 'CLB', licking: 'NBY' };
const CITY_TO_COUNTY = { columbus: 'franklin', lancaster: 'fairfield', newark: 'licking' };
const TAG_TO_DATA_CENTER = { CLB: 'Columbus', LCT: 'Lancaster', NBY: 'Newark' };

const ABBR_MONTH_RE =
  /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+\d{1,2}[,\s]+\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M/i;
const FULL_MONTH_RE =
  /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}[,\s]+\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M/i;
const ISO_RE =
  /\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/;
const SLASH_RE =
  /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AP]M)?)/i;
const COUNTY_RE = /([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+County/i;

const OCR_PROMPT =
  'You are reading a work-photo screenshot for timesheet OCR. ' +
  'Highest priority: find and transcribe the timestamp overlay exactly as shown in the image, ' +
  'including month, day, year, time, and AM/PM. ' +
  'Second priority: transcribe nearby county, city, or location words that belong to the same overlay. ' +
  'Ignore unrelated company boards, street addresses, building signs, slogans, and background text unless no overlay text is readable. ' +
  'If a timestamp is visible, put that timestamp text first in the response. ' +
  'Return plain text only, with no explanation.';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // result is "data:<mime>;base64,<data>" — strip the prefix
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function parseTimestamp(text) {
  if (!text) return null;

  const abbr = text.match(ABBR_MONTH_RE);
  if (abbr) {
    const d = new Date(abbr[0].replace('Sept', 'Sep').replace(/\s+/g, ' '));
    if (!isNaN(d.getTime())) return d;
  }

  const full = text.match(FULL_MONTH_RE);
  if (full) {
    const d = new Date(full[0].replace(/\s+/g, ' '));
    if (!isNaN(d.getTime())) return d;
  }

  const iso = text.match(ISO_RE);
  if (iso) {
    const d = new Date(iso[0]);
    if (!isNaN(d.getTime())) return d;
  }

  const slash = text.match(SLASH_RE);
  if (slash) {
    const d = new Date(`${slash[1]}/${slash[2]}/${slash[3]} ${slash[4]}`);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

function normalizeText(value) {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCounty(text) {
  const countyMatch = (text || '').match(COUNTY_RE);
  if (countyMatch) {
    const normalized = normalizeText(countyMatch[1]);
    if (COUNTY_TAGS[normalized]) return normalized;
  }
  const norm = normalizeText(text);
  for (const county of Object.keys(COUNTY_TAGS)) {
    if (norm.includes(county)) return county;
  }
  for (const [city, county] of Object.entries(CITY_TO_COUNTY)) {
    if (norm.includes(city)) return county;
  }
  return null;
}

function determineLocationTag(county) {
  if (!county) return '';
  return COUNTY_TAGS[county.toLowerCase()] || '';
}

/**
 * Analyze a photo file using Gemini directly from the browser.
 * Returns an object with the same shape as the backend /analyze response.
 * Throws if all Gemini model attempts fail.
 */
export async function analyzeImageClientSide(file) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY is not set');

  const mimeType = file.type || 'image/jpeg';
  const base64Data = await fileToBase64(file);

  const payload = {
    contents: [
      {
        parts: [
          { text: OCR_PROMPT },
          { inline_data: { mime_type: mimeType, data: base64Data } },
        ],
      },
    ],
  };

  let lastError = 'none';
  for (const model of GEMINI_MODELS) {
    let signal;
    try {
      signal = AbortSignal.timeout(15000);
    } catch (_) {
      // AbortSignal.timeout not available in older browsers — proceed without timeout
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        ...(signal ? { signal } : {}),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        const lower = `${response.status} ${body}`.toLowerCase();
        lastError = lower.includes('quota') || lower.includes('rate') || lower.includes('resource_exhausted')
          ? 'quota_or_rate_limit'
          : `http_${response.status}`;
        continue;
      }

      const json = await response.json();
      const texts = [];
      for (const candidate of json.candidates || []) {
        for (const part of candidate?.content?.parts || []) {
          if (part.text) texts.push(part.text.trim());
        }
      }
      const ocrText = texts.join(' ').replace(/\s+/g, ' ').trim();
      if (!ocrText) {
        lastError = 'empty_response';
        continue;
      }

      const timestamp = parseTimestamp(ocrText);
      const county = parseCounty(ocrText);
      const locationTag = determineLocationTag(county);
      const dataCenterLocation = TAG_TO_DATA_CENTER[locationTag] || '';

      return {
        filename: file.name,
        ocr_text: ocrText,
        ocr_engine: 'gemini-client',
        timestamp: timestamp ? timestamp.toISOString() : null,
        date: timestamp ? timestamp.toISOString().split('T')[0] : null,
        time: timestamp
          ? timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : null,
        county: county ? county.charAt(0).toUpperCase() + county.slice(1) : null,
        location_tag: locationTag,
        data_center_location: dataCenterLocation,
        crop: { source_size: [], strategy: 'client-side-gemini' },
      };
    } catch (err) {
      lastError = err?.name === 'AbortError' ? 'timeout' : 'network_error';
    }
  }

  throw new Error(`Client-side Gemini OCR failed: ${lastError}`);
}
