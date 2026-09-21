/**
 * Computes a deterministic SHA-256 hex string from an input string.
 * Uses the standard Web Crypto API (supported in MV3 Service Worker, Content Scripts, and Node 20+).
 */
export async function sha256(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface CacheKeyParams {
  text: string;
  model: string;
  targetLang: string;
  contextBefore?: string;
  contextAfter?: string;
  systemPrompt?: string;
  params?: Record<string, any>;
  memory?: Array<{ source: string; translation: string }>;
}

/**
 * Generates a stable and deterministic cache key for translation requests.
 */
export async function generateCacheKey(params: CacheKeyParams): Promise<string> {
  const normalizedParams = params.params
    ? Object.keys(params.params)
        .sort()
        .map((k) => `${k}:${JSON.stringify(params.params![k])}`)
        .join(';')
    : '';

  const raw = [
    params.text.trim(),
    params.model.trim(),
    params.targetLang.trim(),
    (params.contextBefore || '').trim(),
    (params.contextAfter || '').trim(),
    (params.systemPrompt || '').trim(),
    normalizedParams,
    (params.memory || []).map((m) => `${m.source}=>${m.translation}`).join(';;'),
  ].join('|||');

  return sha256(raw);
}
