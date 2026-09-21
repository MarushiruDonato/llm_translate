/**
 * Normalizes a user-provided Base URL (e.g. "https://api.openai.com/v1/")
 * into a valid Chrome Extension Match Pattern (e.g. "https://api.openai.com/*").
 *
 * Requirements:
 * - Scheme must be http or https
 * - Hostname extracted
 * - Preserves port if provided
 * - Path replaced with /*
 */
export function normalizeToMatchPattern(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    throw new Error('Base URL 不能为空');
  }

  let urlString = trimmed;
  // If no scheme specified (e.g. "api.openai.com/v1"), default to https://
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(urlString)) {
    urlString = `https://${urlString}`;
  }

  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error(`无效的 URL 格式: "${baseUrl}"`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`仅支持 HTTP / HTTPS 协议: "${url.protocol}"`);
  }

  const hostWithPort = url.port ? `${url.hostname}:${url.port}` : url.hostname;
  return `${url.protocol}//${hostWithPort}/*`;
}

/**
 * Normalizes a base URL by trimming whitespace and trailing slashes.
 */
export function cleanBaseUrl(baseUrl: string): string {
  let cleaned = baseUrl.trim();
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }
  return cleaned.replace(/\/+$/, '');
}

/**
 * Generates a Chrome Scroll-to-Text-Fragment URL pointing directly to the selected text.
 * Syntax: https://example.com/page#:~:text=[startText][,endText]
 * When opened in Chrome, the browser automatically navigates, scrolls to the text, and highlights it.
 */
export function generateTextFragmentUrl(pageUrl: string, selectedText: string): string {
  if (!pageUrl || !/^https?:\/\//i.test(pageUrl)) {
    return pageUrl || '';
  }

  const [cleanUrl] = pageUrl.split('#');
  const cleanText = selectedText.replace(/\s+/g, ' ').trim();
  if (!cleanText) return cleanUrl;

  const encodeFragmentPart = (part: string) => encodeURIComponent(part).replace(/-/g, '%2D');

  const words = cleanText.split(' ');
  if (words.length > 8) {
    const start = words.slice(0, 4).join(' ');
    const end = words.slice(-4).join(' ');
    return `${cleanUrl}#:~:text=${encodeFragmentPart(start)},${encodeFragmentPart(end)}`;
  } else if (cleanText.length > 80) {
    const start = cleanText.slice(0, 30).trim();
    const end = cleanText.slice(-30).trim();
    return `${cleanUrl}#:~:text=${encodeFragmentPart(start)},${encodeFragmentPart(end)}`;
  } else {
    return `${cleanUrl}#:~:text=${encodeFragmentPart(cleanText)}`;
  }
}
