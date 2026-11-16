/**
 * Admin Monitoring — In-Memory TTL Cache
 *
 * Simple cache using a Map + timestamp. No Redis required.
 * Prevents hammering GCP Monitoring API and Supabase storage queries
 * on every dashboard refresh.
 *
 * TTL defaults (seconds):
 *   - overview   : 120 (2 min)
 *   - users      : 300 (5 min)
 *   - database   : 300 (5 min)
 *   - storage    : 600 (10 min)
 *   - computing  : 120 (2 min)
 */

class AdminMonitoringCache {
  constructor() {
    /** @type {Map<string, {data: any, expiresAt: number}>} */
    this._store = new Map();
  }

  /**
   * Store a value with a TTL.
   * @param {string} key
   * @param {any} data
   * @param {number} ttlSeconds
   */
  set(key, data, ttlSeconds) {
    this._store.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Retrieve a value if it is still within TTL. Returns null if expired or missing.
   * @param {string} key
   * @returns {any|null}
   */
  get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return null;
    }
    return entry.data;
  }

  /**
   * Invalidate a specific key or all keys if no key is given.
   * @param {string} [key]
   */
  invalidate(key) {
    if (key) {
      this._store.delete(key);
    } else {
      this._store.clear();
    }
  }

  /**
   * Helper: get from cache or run fetcher and store result.
   * @param {string} key
   * @param {number} ttlSeconds
   * @param {() => Promise<any>} fetcher
   */
  async getOrFetch(key, ttlSeconds, fetcher) {
    const cached = this.get(key);
    if (cached !== null) return cached;

    const fresh = await fetcher();
    this.set(key, fresh, ttlSeconds);
    return fresh;
  }
}

// Export singleton — shared across all requests in the same process
module.exports = new AdminMonitoringCache();
