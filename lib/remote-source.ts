export function normalizeRemoteSourceUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';

  const trimmed = url.trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    parsed.search = '';
    parsed.hash = '';
    const normalized = parsed.toString();
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  } catch {
    return trimmed.replace(/[?#].*$/, '').replace(/\/+$/, '');
  }
}

export function isTeraboxUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return /terabox\.(com|net)|teraboxapp\.com|tba\.link/i.test(parsed.hostname) || /terabox/i.test(parsed.href);
  } catch {
    return /terabox\.(com|net)|teraboxapp\.com|tba\.link/i.test(url) || /terabox/i.test(url);
  }
}

export function extractTeraboxDownloadUrl(rawHtml: string): string | null {
  if (!rawHtml || typeof rawHtml !== 'string') return null;

  const patterns = [
    /"dlink"\s*:\s*"(https?:\\?\/\\?\/[^"\\]+)"/i,
    /"dlink"\s*:\s*"(https?:\/\/[^"\\]+)"/i,
    /"downloadUrl"\s*:\s*"(https?:\\?\/\\?\/[^"\\]+)"/i,
    /"download_url"\s*:\s*"(https?:\\?\/\\?\/[^"\\]+)"/i,
    /(?:https?:\\?\/\\?\/[^\s"'<>]+(?:download|dl|dlink)[^\s"'<>]*)/i,
    /https?:\/\/[^\s"'<>]+(?:download|dl|dlink)[^\s"'<>]*/i,
  ];

  for (const pattern of patterns) {
    const match = rawHtml.match(pattern);
    if (match && match[1]) {
      return match[1].replace(/\\\//g, '/');
    }
    if (match && match[0]) {
      return match[0].replace(/\\\//g, '/');
    }
  }

  const jsonLike = rawHtml.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});?/);
  if (jsonLike && jsonLike[1]) {
    const maybeUrl = jsonLike[1].match(/"dlink"\s*:\s*"(https?:\\?\/\\?\/[^"\\]+)"/i);
    if (maybeUrl && maybeUrl[1]) return maybeUrl[1].replace(/\\\//g, '/');
  }

  return null;
}

export async function resolveRemoteSourceUrl(url: string, retries: number = 3): Promise<string> {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';

  const normalized = normalizeRemoteSourceUrl(trimmed);
  if (!normalized || !/^(https?:)/i.test(normalized)) return '';

  if (!isTeraboxUrl(normalized)) {
    return normalized;
  }

  // Terabox note: Modern Terabox (1024terabox.com, terabox.app) requires verification
  console.log('[TERABOX-RESOLVE] Detected Terabox URL - may require verification');

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout per attempt
      
      const response = await fetch(normalized, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'max-age=0',
        },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        console.warn(`[TERABOX-RESOLVE] Attempt ${attempt}/${retries}: HTTP ${response.status}`);
        if (attempt === retries) return normalized;
        await new Promise(r => setTimeout(r, 1000 * attempt)); // backoff
        continue;
      }

      const html = await response.text();
      if (!html || html.length < 100) {
        console.warn(`[TERABOX-RESOLVE] Attempt ${attempt}/${retries}: Empty HTML response`);
        if (attempt === retries) return normalized;
        await new Promise(r => setTimeout(r, 1000 * attempt));
        continue;
      }

      const extracted = extractTeraboxDownloadUrl(html) || response.url;
      if (extracted && /^https?:/i.test(extracted)) {
        console.log(`[TERABOX-RESOLVE] Success on attempt ${attempt}: ${extracted.split('?')[0]}`);
        return extracted;
      }
      
      console.warn(`[TERABOX-RESOLVE] Attempt ${attempt}/${retries}: Could not extract download URL`);
      if (attempt === retries) return normalized;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    } catch (err: any) {
      console.warn(`[TERABOX-RESOLVE] Attempt ${attempt}/${retries} error:`, err.message || 'Unknown');
      if (attempt === retries) return normalized;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }

  return normalized;
}

export function matchSelectedRemoteSource(file: any, selectedItems: any[] = []): boolean {
  if (!file || !Array.isArray(selectedItems) || selectedItems.length === 0) return false;

  const candidateValues = new Set<string>([
    String(file.id || ''),
    String(file.file_id || ''),
    String(file.telegram_file_id || ''),
    String(file.terabox_file_id || ''),
    String(file.source_url || ''),
    String(file.remote_url || ''),
    String(file.terabox_url || ''),
    String(file.telegram_url || ''),
    String(file.url || ''),
    String(file.link || ''),
  ]);

  const normalizedFileValues = [...candidateValues]
    .map((value) => normalizeRemoteSourceUrl(value))
    .filter(Boolean);

  for (const item of selectedItems) {
    if (!item) continue;

    const itemValues = [
      item.file_id,
      item.id,
      item.telegram_file_id,
      item.terabox_file_id,
      item.source_url,
      item.remote_url,
      item.terabox_url,
      item.telegram_url,
      item.url,
      item.link,
    ];

    for (const rawValue of itemValues) {
      if (!rawValue && rawValue !== 0) continue;

      const directMatches = String(rawValue);
      if (candidateValues.has(directMatches)) {
        return true;
      }

      const normalizedItem = normalizeRemoteSourceUrl(directMatches);
      if (normalizedItem && normalizedFileValues.includes(normalizedItem)) {
        return true;
      }

      for (const fileValue of normalizedFileValues) {
        if (fileValue && normalizedItem && fileValue === normalizedItem) {
          return true;
        }
      }
    }
  }

  return false;
}
