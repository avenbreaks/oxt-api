export class CacheService {
  constructor(namespace = 'default') {
    this.namespace = namespace;
    this.cache = new Map();
    this.defaultTTL = parseInt(process.env.CACHE_DURATION) || 30000;
    this.maxSize = parseInt(process.env.CACHE_MAX_SIZE) || 1000;
    
    // Cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Cleanup every minute
  }

  /**
   * Generate namespaced key
   */
  _getKey(key) {
    return `${this.namespace}:${key}`;
  }

  /**
   * Set cache entry
   */
  set(key, value, ttl = this.defaultTTL) {
    const namespacedKey = this._getKey(key);
    
    // Check cache size limit
    if (this.cache.size >= this.maxSize) {
      this._evictLRU();
    }
    
    const entry = {
      value,
      timestamp: Date.now(),
      ttl,
      lastAccessed: Date.now()
    };
    
    this.cache.set(namespacedKey, entry);
    return true;
  }

  /**
   * Get cache entry
   */
  get(key) {
    const namespacedKey = this._getKey(key);
    const entry = this.cache.get(namespacedKey);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(namespacedKey);
      return null;
    }
    
    // Update last accessed time
    entry.lastAccessed = Date.now();
    return entry.value;
  }

  /**
   * Delete cache entry
   */
  delete(key) {
    const namespacedKey = this._getKey(key);
    return this.cache.delete(namespacedKey);
  }

  /**
   * Clear all cache entries for this namespace
   */
  clear() {
    const keys = Array.from(this.cache.keys()).filter(key => 
      key.startsWith(`${this.namespace}:`)
    );
    
    keys.forEach(key => this.cache.delete(key));
    return keys.length;
  }

  /**
   * Get all keys for this namespace
   */
  keys() {
    return Array.from(this.cache.keys())
      .filter(key => key.startsWith(`${this.namespace}:`))
      .map(key => key.replace(`${this.namespace}:`, ''));
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    const expiredKeys = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (Date.now() - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        expiredKeys.push(key);
      }
    }
    
    return expiredKeys.length;
  }

  /**
   * Evict least recently used entry
   */
  _evictLRU() {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Destroy cache service
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

// Global cache manager
class CacheManager {
  constructor() {
    this.caches = new Map();
  }

  getCache(namespace) {
    if (!this.caches.has(namespace)) {
      this.caches.set(namespace, new CacheService(namespace));
    }
    return this.caches.get(namespace);
  }

  getAllStats() {
    const stats = {};
    for (const [namespace, cache] of this.caches.entries()) {
      stats[namespace] = {
        namespace,
        size: cache.cache.size
      };
    }
    return stats;
  }

  clearAll() {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
  }

  destroy() {
    for (const cache of this.caches.values()) {
      cache.destroy();
    }
    this.caches.clear();
  }
}

export const cacheManager = new CacheManager();