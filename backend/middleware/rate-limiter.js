// middleware/rate-limiter.js - Enhanced rate limiting middleware
import rateLimit from 'express-rate-limit';
// import RedisStore from 'rate-limit-redis';
// import { createClient } from 'redis';

// Redis client for rate limiting (optional)
let redisClient = null;
let redisConnected = false;

// Temporarily disabled - Redis not configured
// if (process.env.REDIS_URL) {
//   try {
//     redisClient = createClient({
//       url: process.env.REDIS_URL
//     });
//     
//     redisClient.on('error', (err) => {
//       console.log('Redis Client Error:', err);
//       redisConnected = false;
//     });
//     
//     redisClient.on('ready', () => {
//       console.log('Redis connected for rate limiting');
//       redisConnected = true;
//     });
//     
//     redisClient.connect().catch(err => {
//       console.log('Redis connection failed, using memory store for rate limiting');
//       redisClient = null;
//       redisConnected = false;
//     });
//   } catch (err) {
//     console.log('Redis initialization failed, using memory store for rate limiting');
//     redisClient = null;
//     redisConnected = false;
//   }
// }

// Helper to create rate limiter with Redis store if available
const createRateLimiter = (options) => {
  const config = {
    standardHeaders: true,
    legacyHeaders: false,
    ...options
  };
  
  // Use Redis store if available and connected
  // if (redisClient && redisConnected) {
  //   try {
  //     config.store = new RedisStore({
  //       client: redisClient,
  //       prefix: 'rate-limit:',
  //     });
  //   } catch (err) {
  //     console.log('Failed to create Redis store, using memory store:', err.message);
  //   }
  // }
  
  return rateLimit(config);
};

// Authentication endpoints (strict)
export const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5'), // 5 attempts
  message: {
    error: 'Too many authentication attempts, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: 15
  },
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    // Use IP + user email for more granular limiting
    return req.ip + ':' + (req.body?.email || 'unknown');
  }
});

// Password reset (very strict)
export const passwordResetRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: {
    error: 'Too many password reset attempts, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: 60
  },
  skipSuccessfulRequests: false
});

// Token refresh (moderate)
export const refreshTokenRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 refreshes per 15 min
  message: {
    error: 'Too many token refresh attempts',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: 15
  }
});

// General API endpoints (lenient)
export const apiRateLimit = createRateLimiter({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute default
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // 100 requests per minute
  message: {
    error: 'Too many requests, please slow down',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  keyGenerator: (req) => {
    // Use authenticated user ID if available, otherwise IP
    return req.user?.id || req.ip;
  }
});

// Data export endpoints (strict to prevent abuse)
export const dataExportRateLimit = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5, // 5 exports per day
  message: {
    error: 'Too many data export requests, please try again tomorrow',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: 24 * 60
  }
});

// Write operations (moderate)
export const writeRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 writes per minute
  message: {
    error: 'Too many write operations, please slow down',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  }
});

// Deal categorization (to prevent ML training data pollution)
export const categorizationRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 categorizations per minute
  message: {
    error: 'Too many categorization changes, please slow down',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

// Commission approval (prevent spam approvals)
export const approvalRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 approvals per minute
  message: {
    error: 'Too many approval actions, please slow down',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

// Integration sync (expensive operations)
export const integrationSyncRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 syncs per hour
  message: {
    error: 'Too many sync requests, please wait before syncing again',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: 60
  }
});

// Dynamic rate limiting based on user role
export const dynamicRateLimit = (req, res, next) => {
  // Admins get higher limits
  if (req.user?.is_admin) {
    return next();
  }
  
  // Managers get moderate limits
  if (req.user?.is_manager) {
    const managerLimit = createRateLimiter({
      windowMs: 60 * 1000,
      max: 200, // Double the normal limit
      message: {
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED'
      }
    });
    return managerLimit(req, res, next);
  }
  
  // Regular users get standard limits
  return apiRateLimit(req, res, next);
};

// Cleanup function for graceful shutdown
export const cleanup = async () => {
  if (redisClient) {
    await redisClient.quit();
  }
};

export default {
  authRateLimit,
  passwordResetRateLimit,
  refreshTokenRateLimit,
  apiRateLimit,
  dataExportRateLimit,
  writeRateLimit,
  categorizationRateLimit,
  approvalRateLimit,
  integrationSyncRateLimit,
  dynamicRateLimit,
  cleanup
};