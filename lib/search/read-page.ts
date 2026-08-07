/**
 * Fetch a public web page and reduce it to plain text for the model. Only
 * ever called from the operator's research loop, only when research is
 * enabled, and only for URLs the guard below accepts.
 */

const TIMEOUT_MS = 15_000;
const MAX_CHARS = 4_000;
const MAX_BYTES = 2_000_000;

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /\.local$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^\[?::1\]?$/,
  /^\[?f[cd][0-9a-f]{2}:/i,
];

/**
 * SSRF guard: research reads the public web, never this machine or the
 * local network. Returns an error string, or undefined when the URL is ok.
 * (Set OTTO_RESEARCH_ALLOW_PRIVATE=1 to disable — for automated tests that
 * serve mock pages from localhost ONLY; never set it otherwise.)
 */
export function refuseUrl(rawUrl: string): string | undefined {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return 'That is not a valid URL.';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return 'Only http(s) pages can be read.';
  }
  if (process.env.OTTO_RESEARCH_ALLOW_PRIVATE === '1') {
    return undefined;
  }
  if (PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))) {
    return 'Local and private-network addresses cannot be read.';
  }
  return undefined;
}

/** Crude but dependency-free HTML → text: drop scripts/styles/tags, keep prose. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/h[1-6]|\/li|\/tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

export interface PageContent {
  url: string;
  title: string;
  text: string;
  truncated: boolean;
}

export async function readPage(rawUrl: string): Promise<PageContent> {
  const refusal = refuseUrl(rawUrl);
  if (refusal) {
    throw new Error(refusal);
  }

  const response = await fetch(rawUrl, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: 'follow',
    headers: { accept: 'text/html,text/plain,*/*', 'user-agent': 'otto-research (+https://github.com/justshipai/otto)' },
  });
  if (!response.ok) {
    throw new Error(`The page returned ${response.status}.`);
  }

  const raw = (await response.text()).slice(0, MAX_BYTES);
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(raw)?.[1]?.trim() ?? rawUrl;
  const contentType = response.headers.get('content-type') ?? '';
  const text = contentType.includes('html') || /<html[\s>]/i.test(raw) ? htmlToText(raw) : raw.trim();

  return {
    url: rawUrl,
    title: htmlToText(title),
    text: text.slice(0, MAX_CHARS),
    truncated: text.length > MAX_CHARS,
  };
}
