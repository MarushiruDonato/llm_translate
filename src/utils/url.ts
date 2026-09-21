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
