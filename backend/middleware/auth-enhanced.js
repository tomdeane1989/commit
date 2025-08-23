// middleware/auth-enhanced.js - Enhanced authentication with refresh tokens
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Token configuration
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '1h';
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '7d';
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET;

// Generate access token (short-lived)
export const generateAccessToken = (user) => {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET not configured');
  }
  
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      is_admin: user.is_admin,
      is_manager: user.is_manager,
      company_id: user.company_id,
      type: 'access'
    },
    JWT_SECRET,
    { 
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
      issuer: 'sales-commission-saas',
      audience: 'api'
    }
  );
};

// Generate refresh token (long-lived)
export const generateRefreshToken = async (user) => {
  if (!JWT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET not configured');
  }
  
  // Generate unique token ID
  const tokenId = crypto.randomBytes(32).toString('hex');
  
  // Store refresh token in database
  await prisma.refresh_tokens.create({
    data: {
      token_id: tokenId,
      user_id: user.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      created_at: new Date()
    }
  });
  
  return jwt.sign(
    {
      id: user.id,
      tokenId: tokenId,
      type: 'refresh'
    },
    JWT_REFRESH_SECRET,
    { 
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
      issuer: 'sales-commission-saas',
      audience: 'refresh'
    }
  );
};

// Verify and decode access token
export const verifyAccessToken = (token) => {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET not configured');
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'sales-commission-saas',
      audience: 'api'
    });
    
    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }
    
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Access token expired');
    }
    throw error;
  }
};

// Verify and decode refresh token
export const verifyRefreshToken = async (token) => {
  if (!JWT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET not configured');
  }
  
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'sales-commission-saas',
      audience: 'refresh'
    });
    
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    
    // Check if token exists in database and is not revoked
    const storedToken = await prisma.refresh_tokens.findFirst({
      where: {
        token_id: decoded.tokenId,
        user_id: decoded.id,
        revoked: false,
        expires_at: {
          gt: new Date()
        }
      }
    });
    
    if (!storedToken) {
      throw new Error('Refresh token not found or revoked');
    }
    
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Refresh token expired');
    }
    throw error;
  }
};

// Revoke refresh token
export const revokeRefreshToken = async (tokenId) => {
  await prisma.refresh_tokens.updateMany({
    where: {
      token_id: tokenId
    },
    data: {
      revoked: true,
      revoked_at: new Date()
    }
  });
};

// Revoke all refresh tokens for a user
export const revokeAllUserTokens = async (userId) => {
  await prisma.refresh_tokens.updateMany({
    where: {
      user_id: userId,
      revoked: false
    },
    data: {
      revoked: true,
      revoked_at: new Date()
    }
  });
};

// Clean up expired tokens (run periodically)
export const cleanupExpiredTokens = async () => {
  const result = await prisma.refresh_tokens.deleteMany({
    where: {
      OR: [
        { expires_at: { lt: new Date() } },
        { 
          revoked: true,
          revoked_at: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Revoked more than 24h ago
        }
      ]
    }
  });
  
  return result.count;
};

// Enhanced authentication middleware
export const authenticateTokenEnhanced = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Access denied. No authentication token provided.',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify access token
    const decoded = verifyAccessToken(token);

    // Fetch fresh user data from database
    const user = await prisma.users.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        is_admin: true,
        is_manager: true,
        company_id: true,
        is_active: true,
        last_login: true
      }
    });

    if (!user || !user.is_active) {
      return res.status(401).json({
        error: 'User not found or inactive',
        code: 'USER_INACTIVE'
      });
    }

    // Update last activity
    await prisma.users.update({
      where: { id: user.id },
      data: { 
        last_activity: new Date()
      }
    });

    // Attach user to request
    req.user = user;
    req.tokenData = decoded;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error.message);
    
    if (error.message === 'Access token expired') {
      return res.status(401).json({
        error: 'Access token expired',
        code: 'TOKEN_EXPIRED',
        requiresRefresh: true
      });
    }
    
    if (error.message === 'jwt malformed' || error.message === 'invalid signature') {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    
    return res.status(401).json({
      error: 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }
};

// Refresh token endpoint handler
export const handleTokenRefresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token required',
        code: 'NO_REFRESH_TOKEN'
      });
    }
    
    // Verify refresh token
    const decoded = await verifyRefreshToken(refreshToken);
    
    // Get user data
    const user = await prisma.users.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        is_admin: true,
        is_manager: true,
        company_id: true,
        is_active: true
      }
    });
    
    if (!user || !user.is_active) {
      // Revoke the refresh token
      await revokeRefreshToken(decoded.tokenId);
      
      return res.status(401).json({
        error: 'User not found or inactive',
        code: 'USER_INACTIVE'
      });
    }
    
    // Generate new access token
    const newAccessToken = generateAccessToken(user);
    
    // Optionally rotate refresh token (recommended for security)
    let newRefreshToken = refreshToken;
    if (process.env.ROTATE_REFRESH_TOKENS === 'true') {
      // Revoke old refresh token
      await revokeRefreshToken(decoded.tokenId);
      
      // Generate new refresh token
      newRefreshToken = await generateRefreshToken(user);
    }
    
    // Update last login
    await prisma.users.update({
      where: { id: user.id },
      data: { 
        last_login: new Date(),
        last_activity: new Date()
      }
    });
    
    res.json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        is_admin: user.is_admin,
        is_manager: user.is_manager
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    
    res.status(401).json({
      error: 'Failed to refresh token',
      code: 'REFRESH_FAILED',
      message: error.message
    });
  }
};

export default {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  cleanupExpiredTokens,
  authenticateTokenEnhanced,
  handleTokenRefresh
};