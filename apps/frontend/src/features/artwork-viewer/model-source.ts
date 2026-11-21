// model-viewer 4.4.0 caches a failed load under its URL, so a retry needs a new
// cache key. The fragment changes the key without reaching the server.
export function modelSource(url: string, attempt: number): string {
  if (attempt === 0) return url;
  return `${url.replace(/#.*$/, '')}#retry-${String(attempt)}`;
}
