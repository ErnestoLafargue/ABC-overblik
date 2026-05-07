type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  existing.count += 1;
  if (existing.count > limit) {
    return true;
  }
  return false;
}

export function clientKey(req: {
  headers?: Record<string, string | string[] | undefined>;
}): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (value) return value.split(',')[0]?.trim() || 'unknown';
  const realIp = req.headers?.['x-real-ip'];
  return Array.isArray(realIp) ? realIp[0] ?? 'unknown' : realIp ?? 'unknown';
}
