/**
 * Multi-Tiered In-Memory Caching for Sports Data Providers (SerpApi / Live Feeds)
 * Minimizes API costs, prevents redundant external requests, and respects data freshness tiers:
 *   - LIVE / IN-PROGRESS: 60 seconds TTL
 *   - UPCOMING / TODAY'S SLATE: 10 minutes (600s) TTL
 *   - STATIC / STANDINGS / COMPLETED: 1 hour (3600s) TTL
 */

class SportsDataCache {
  constructor() {
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0
    };

    // Periodic sweep every 5 minutes to reclaim expired memory
    this.cleanupInterval = setInterval(() => this.purgeExpired(), 5 * 60 * 1000);
    if (this.cleanupInterval.unref) this.cleanupInterval.unref();
  }

  /**
   * Generates a cache key.
   */
  generateKey(prefix, params = {}) {
    const sorted = Object.keys(params)
      .sort()
      .map(k => `${k}:${String(params[k] || '').toLowerCase()}`)
      .join('|');
    return `${prefix}::${sorted}`;
  }

  /**
   * Gets cached entry if valid.
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return {
      ...entry.data,
      _fromCache: true,
      _cachedAt: entry.createdAt,
      _ttlRemainingMs: entry.expiresAt - Date.now()
    };
  }

  /**
   * Sets cache entry with configurable TTL in seconds.
   */
  set(key, data, ttlSeconds = 600) {
    const ttlMs = (Number(process.env.CACHE_TTL_DEFAULT) || ttlSeconds) * 1000;
    this.cache.set(key, {
      data,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttlMs
    });
    this.stats.sets++;
  }

  /**
   * Delete specific key or pattern.
   */
  invalidate(keyOrPrefix) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(keyOrPrefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Purge expired items.
   */
  purgeExpired() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  getMetrics() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: total > 0 ? `${((this.stats.hits / total) * 100).toFixed(1)}%` : '0%'
    };
  }
}

export const sportsCache = new SportsDataCache();
export default sportsCache;
