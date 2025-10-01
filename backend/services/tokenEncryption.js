// Token Encryption Service
// Handles encryption and decryption of sensitive tokens stored in the database
import crypto from 'crypto';

class TokenEncryptionService {
  constructor() {
    // Use environment variable or generate a secure key
    this.encryptionKey = process.env.TOKEN_ENCRYPTION_KEY || this.generateDefaultKey();
    
    if (!process.env.TOKEN_ENCRYPTION_KEY) {
      console.warn('⚠️ TOKEN_ENCRYPTION_KEY not set in environment variables');
      console.warn('Using default key - MUST be set for production!');
    }
    
    // Algorithm for encryption
    this.algorithm = 'aes-256-gcm';
    
    // Ensure key is 32 bytes for AES-256
    this.key = crypto.createHash('sha256').update(this.encryptionKey).digest();
  }
  
  generateDefaultKey() {
    // Generate a development key based on JWT secret if available
    if (process.env.JWT_SECRET) {
      return `token-encryption-${process.env.JWT_SECRET}`;
    }
    // Fallback for development only
    return 'development-token-encryption-key-CHANGE-IN-PRODUCTION';
  }
  
  /**
   * Encrypt a token for storage in database
   * @param {string} plainToken - The token to encrypt
   * @returns {object} Encrypted token with IV and auth tag
   */
  encrypt(plainToken) {
    if (!plainToken) return null;
    
    try {
      // Generate random initialization vector
      const iv = crypto.randomBytes(16);
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      
      // Encrypt the token
      let encrypted = cipher.update(plainToken, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get auth tag for authenticated encryption
      const authTag = cipher.getAuthTag();
      
      // Return encrypted data with metadata
      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        algorithm: this.algorithm,
        version: 1 // Version for future migration support
      };
    } catch (error) {
      console.error('Token encryption error:', error);
      throw new Error('Failed to encrypt token');
    }
  }
  
  /**
   * Decrypt a token from database storage
   * @param {object} encryptedData - Encrypted token object
   * @returns {string} Decrypted token
   */
  decrypt(encryptedData) {
    if (!encryptedData) return null;
    
    // Handle both old plain tokens and new encrypted tokens
    if (typeof encryptedData === 'string') {
      // Legacy plain token - return as is
      // This allows gradual migration
      console.warn('⚠️ Found unencrypted token in database');
      return encryptedData;
    }
    
    try {
      // Extract encryption components
      const { encrypted, iv, authTag, algorithm } = encryptedData;
      
      // Verify algorithm matches
      if (algorithm && algorithm !== this.algorithm) {
        throw new Error(`Unsupported encryption algorithm: ${algorithm}`);
      }
      
      // Convert from hex strings
      const ivBuffer = Buffer.from(iv, 'hex');
      const authTagBuffer = Buffer.from(authTag, 'hex');
      
      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, ivBuffer);
      decipher.setAuthTag(authTagBuffer);
      
      // Decrypt the token
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Token decryption error:', error);
      throw new Error('Failed to decrypt token');
    }
  }
  
  /**
   * Encrypt tokens for database storage
   * @param {string} accessToken - Access token to encrypt
   * @param {string} refreshToken - Refresh token to encrypt
   * @returns {object} Encrypted tokens
   */
  encryptTokens(accessToken, refreshToken) {
    return {
      access_token: accessToken ? JSON.stringify(this.encrypt(accessToken)) : null,
      refresh_token: refreshToken ? JSON.stringify(this.encrypt(refreshToken)) : null
    };
  }
  
  /**
   * Decrypt tokens from database storage
   * @param {string} encryptedAccess - Encrypted access token from DB
   * @param {string} encryptedRefresh - Encrypted refresh token from DB
   * @returns {object} Decrypted tokens
   */
  decryptTokens(encryptedAccess, encryptedRefresh) {
    let accessToken = null;
    let refreshToken = null;
    
    // Decrypt access token
    if (encryptedAccess) {
      try {
        // Try to parse as JSON (new encrypted format)
        const accessData = JSON.parse(encryptedAccess);
        accessToken = this.decrypt(accessData);
      } catch {
        // Fallback for legacy plain tokens
        accessToken = encryptedAccess;
      }
    }
    
    // Decrypt refresh token
    if (encryptedRefresh) {
      try {
        // Try to parse as JSON (new encrypted format)
        const refreshData = JSON.parse(encryptedRefresh);
        refreshToken = this.decrypt(refreshData);
      } catch {
        // Fallback for legacy plain tokens
        refreshToken = encryptedRefresh;
      }
    }
    
    return { accessToken, refreshToken };
  }
  
  /**
   * Migrate existing plain tokens to encrypted format
   * @param {object} integration - Integration record from database
   * @returns {object} Updated tokens for database
   */
  migrateTokens(integration) {
    if (!integration) return null;
    
    const { access_token, refresh_token } = integration;
    
    // Check if tokens are already encrypted
    const isAccessEncrypted = this.isEncrypted(access_token);
    const isRefreshEncrypted = this.isEncrypted(refresh_token);
    
    // If both are encrypted, no migration needed
    if (isAccessEncrypted && isRefreshEncrypted) {
      return null;
    }
    
    // Encrypt any plain tokens
    const updates = {};
    
    if (!isAccessEncrypted && access_token) {
      updates.access_token = JSON.stringify(this.encrypt(access_token));
    }
    
    if (!isRefreshEncrypted && refresh_token) {
      updates.refresh_token = JSON.stringify(this.encrypt(refresh_token));
    }
    
    return Object.keys(updates).length > 0 ? updates : null;
  }
  
  /**
   * Check if a token is encrypted
   * @param {string} token - Token to check
   * @returns {boolean} True if encrypted
   */
  isEncrypted(token) {
    if (!token) return false;
    
    try {
      const parsed = JSON.parse(token);
      return parsed.encrypted && parsed.iv && parsed.authTag;
    } catch {
      // Not JSON, so it's a plain token
      return false;
    }
  }
  
  /**
   * Generate a secure encryption key for production
   * @returns {string} Base64 encoded key
   */
  static generateSecureKey() {
    const key = crypto.randomBytes(32);
    return key.toString('base64');
  }
}

// Export singleton instance
const tokenEncryption = new TokenEncryptionService();
export default tokenEncryption;

// Export class for testing
export { TokenEncryptionService };