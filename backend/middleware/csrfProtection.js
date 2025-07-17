// middleware/csrfProtection.js - Simple CSRF protection
import crypto from 'crypto';

// Store CSRF tokens in memory (in production, use Redis or database)
const csrfTokens = new Map();

// Generate secure CSRF token
export const generateCSRFToken = (req) => {
  const token = crypto.randomBytes(32).toString('hex');
  const sessionId = req.cookies.sessionId || crypto.randomUUID();
  
  // Store token with expiry (10 minutes)
  csrfTokens.set(sessionId, {
    token,
    expires: Date.now() + 10 * 60 * 1000
  });
  
  // Clean up expired tokens
  for (const [id, data] of csrfTokens.entries()) {
    if (data.expires < Date.now()) {
      csrfTokens.delete(id);
    }
  }
  
  return { token, sessionId };
};

// Verify CSRF token
export const verifyCSRFToken = (req, receivedToken) => {
  const sessionId = req.cookies.sessionId;
  if (!sessionId) return false;
  
  const tokenData = csrfTokens.get(sessionId);
  if (!tokenData || tokenData.expires < Date.now()) {
    csrfTokens.delete(sessionId);
    return false;
  }
  
  return tokenData.token === receivedToken;
};

// CSRF protection middleware
export const csrfProtection = (req, res, next) => {
  // Skip CSRF for GET requests and authentication endpoints
  if (req.method === 'GET' || req.path.startsWith('/api/auth')) {
    return next();
  }
  
  const receivedToken = req.get('X-CSRF-Token');
  
  if (!receivedToken || !verifyCSRFToken(req, receivedToken)) {
    return res.status(403).json({
      error: 'Invalid CSRF token',
      code: 'CSRF_INVALID'
    });
  }
  
  next();
};

// Endpoint to get CSRF token
export const csrfTokenHandler = (req, res) => {
  const { token, sessionId } = generateCSRFToken(req);
  
  // Set session cookie
  res.cookie('sessionId', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 10 * 60 * 1000 // 10 minutes
  });
  
  res.json({
    success: true,
    csrfToken: token
  });
};