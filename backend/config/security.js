// config/security.js - Centralized security configuration
import helmet from 'helmet';
import cors from 'cors';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import compression from 'compression';

// Security headers configuration
export const configureSecurityHeaders = (app) => {
  // Helmet for security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Remove unsafe-eval in production
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'none'"],
        manifestSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xssFilter: true,
  }));

  // CORS configuration
  const corsOptions = {
    origin: function (origin, callback) {
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        'http://localhost:3000',
        'http://localhost:3001',
        'https://sales-commission-saas.vercel.app'
      ].filter(Boolean);

      // Allow requests with no origin (like mobile apps)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400 // 24 hours
  };

  app.use(cors(corsOptions));

  // Prevent NoSQL injection attacks
  app.use(mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }) => {
      console.warn(`NoSQL injection attempt blocked: ${key}`);
    }
  }));

  // Prevent HTTP Parameter Pollution
  app.use(hpp({
    whitelist: ['sort', 'fields', 'page', 'limit'] // Allow these duplicate params
  }));

  // Compression middleware
  app.use(compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
    level: 6 // Balanced compression level
  }));

  // Additional security headers
  app.use((req, res, next) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Disable client-side caching for sensitive data
    if (req.url.includes('/api/auth') || req.url.includes('/api/gdpr')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    
    // Add request ID for tracing
    req.id = crypto.randomUUID();
    res.setHeader('X-Request-ID', req.id);
    
    next();
  });
};

// Environment variable validation
export const validateEnvironment = () => {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'NODE_ENV'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate JWT secret strength
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.warn('WARNING: JWT_SECRET should be at least 32 characters long');
  }

  // Warn about development settings in production
  if (process.env.NODE_ENV === 'production') {
    if (process.env.JWT_SECRET === 'development-jwt-secret-key-123') {
      throw new Error('Cannot use development JWT secret in production');
    }
    
    if (!process.env.REDIS_URL) {
      console.warn('WARNING: Redis not configured, rate limiting will use memory store');
    }
    
    if (!process.env.SESSION_SECRET) {
      console.warn('WARNING: SESSION_SECRET not configured');
    }
  }
};

// Security monitoring
export const securityMonitoring = (app) => {
  // Log security events
  app.use((req, res, next) => {
    // Log suspicious activities
    const suspiciousPatterns = [
      /\.\.\//g, // Directory traversal
      /<script/gi, // XSS attempts
      /union.*select/gi, // SQL injection
      /eval\(/gi, // Code injection
      /javascript:/gi, // XSS via javascript protocol
    ];

    const checkSuspicious = (str) => {
      if (typeof str !== 'string') return false;
      return suspiciousPatterns.some(pattern => pattern.test(str));
    };

    const url = req.url + (req.originalUrl || '');
    const suspicious = checkSuspicious(url) || 
                      checkSuspicious(JSON.stringify(req.query)) ||
                      checkSuspicious(JSON.stringify(req.body));

    if (suspicious) {
      console.warn('🚨 Suspicious request detected:', {
        ip: req.ip,
        method: req.method,
        url: req.url,
        user: req.user?.email,
        timestamp: new Date().toISOString()
      });
    }

    next();
  });

  // Track failed authentication attempts
  let failedAttempts = new Map();
  
  app.use((req, res, next) => {
    if (req.path === '/auth/login') {
      const originalSend = res.send;
      res.send = function(data) {
        const response = JSON.parse(data);
        if (response.error && response.code === 'INVALID_CREDENTIALS') {
          const key = req.ip;
          const attempts = failedAttempts.get(key) || 0;
          failedAttempts.set(key, attempts + 1);
          
          if (attempts > 5) {
            console.warn('🚨 Multiple failed login attempts:', {
              ip: req.ip,
              attempts: attempts + 1,
              email: req.body?.email
            });
          }
        }
        originalSend.call(this, data);
      };
    }
    next();
  });

  // Clear failed attempts periodically
  setInterval(() => {
    failedAttempts.clear();
  }, 15 * 60 * 1000); // Every 15 minutes
};

// Error handling for security issues
export const securityErrorHandler = (err, req, res, next) => {
  // Log security errors
  if (err.message && err.message.includes('CORS')) {
    console.error('CORS error:', {
      origin: req.get('origin'),
      method: req.method,
      url: req.url
    });
    return res.status(403).json({
      error: 'Cross-origin request blocked',
      code: 'CORS_ERROR'
    });
  }

  if (err.message && err.message.includes('CSRF')) {
    console.error('CSRF error:', {
      ip: req.ip,
      user: req.user?.email
    });
    return res.status(403).json({
      error: 'Invalid CSRF token',
      code: 'CSRF_ERROR'
    });
  }

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production') {
    console.error('Internal error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }

  next(err);
};

export default {
  configureSecurityHeaders,
  validateEnvironment,
  securityMonitoring,
  securityErrorHandler
};