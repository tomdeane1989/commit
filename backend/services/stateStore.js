// State Store Service for OAuth and other temporary data
// Uses Redis in production, falls back to in-memory for development

import Redis from 'ioredis';

class StateStore {
  constructor() {
    this.redis = null;
    this.memoryStore = new Map();
    this.isRedisAvailable = false;
    
    // Initialize Redis if URL is provided
    if (process.env.REDIS_URL) {
      try {
        this.redis = new Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
          enableOfflineQueue: false
        });
        
        this.redis.on('error', (err) => {
          console.error('Redis connection error:', err.message);
          this.isRedisAvailable = false;
        });
        
        this.redis.on('connect', () => {
          console.log('✅ Redis connected for state storage');
          this.isRedisAvailable = true;
        });
        
        // Test connection
        this.redis.ping().then(() => {
          this.isRedisAvailable = true;
        }).catch(() => {
          console.warn('⚠️ Redis not available, using in-memory state store');
          this.isRedisAvailable = false;
        });
      } catch (error) {
        console.warn('⚠️ Failed to initialize Redis, using in-memory state store:', error.message);
        this.isRedisAvailable = false;
      }
    } else {
      console.warn('⚠️ REDIS_URL not configured, using in-memory state store (not suitable for production)');
    }
  }
  
  async set(key, value, ttlSeconds = 600) {
    const data = JSON.stringify(value);
    
    if (this.isRedisAvailable && this.redis) {
      try {
        await this.redis.setex(key, ttlSeconds, data);
        return true;
      } catch (error) {
        console.error('Redis set error:', error.message);
        // Fall back to memory store
        this.memoryStore.set(key, {
          data: value,
          expires: Date.now() + (ttlSeconds * 1000)
        });
        return true;
      }
    } else {
      // Use in-memory store with TTL
      this.memoryStore.set(key, {
        data: value,
        expires: Date.now() + (ttlSeconds * 1000)
      });
      
      // Clean up expired entries periodically
      this.cleanupMemoryStore();
      return true;
    }
  }
  
  async get(key) {
    if (this.isRedisAvailable && this.redis) {
      try {
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
      } catch (error) {
        console.error('Redis get error:', error.message);
        // Fall back to memory store
        const entry = this.memoryStore.get(key);
        if (entry && entry.expires > Date.now()) {
          return entry.data;
        }
        return null;
      }
    } else {
      // Use in-memory store
      const entry = this.memoryStore.get(key);
      if (entry) {
        if (entry.expires > Date.now()) {
          return entry.data;
        } else {
          this.memoryStore.delete(key);
        }
      }
      return null;
    }
  }
  
  async delete(key) {
    if (this.isRedisAvailable && this.redis) {
      try {
        await this.redis.del(key);
      } catch (error) {
        console.error('Redis delete error:', error.message);
      }
    }
    this.memoryStore.delete(key);
  }
  
  async has(key) {
    if (this.isRedisAvailable && this.redis) {
      try {
        const exists = await this.redis.exists(key);
        return exists === 1;
      } catch (error) {
        console.error('Redis exists error:', error.message);
        // Fall back to memory store
        const entry = this.memoryStore.get(key);
        return entry && entry.expires > Date.now();
      }
    } else {
      const entry = this.memoryStore.get(key);
      return entry && entry.expires > Date.now();
    }
  }
  
  cleanupMemoryStore() {
    const now = Date.now();
    for (const [key, value] of this.memoryStore.entries()) {
      if (value.expires < now) {
        this.memoryStore.delete(key);
      }
    }
  }
  
  // OAuth-specific methods
  async setOAuthState(state, companyId, ttlSeconds = 600) {
    return this.set(`oauth:state:${state}`, {
      companyId,
      timestamp: Date.now()
    }, ttlSeconds);
  }
  
  async getOAuthState(state) {
    const data = await this.get(`oauth:state:${state}`);
    // Delete after retrieval for security (one-time use)
    if (data) {
      await this.delete(`oauth:state:${state}`);
    }
    return data;
  }
  
  async hasOAuthState(state) {
    return this.has(`oauth:state:${state}`);
  }
}

// Export singleton instance
const stateStore = new StateStore();
export default stateStore;