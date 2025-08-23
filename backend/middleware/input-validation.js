// middleware/input-validation.js - Comprehensive input validation and sanitization
import Joi from 'joi';
import xss from 'xss';
import validator from 'validator';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// XSS sanitization options
const xssOptions = {
  whiteList: {}, // No HTML tags allowed by default
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script']
};

// Sanitize string input
export const sanitizeString = (input) => {
  if (typeof input !== 'string') return input;
  
  // Remove XSS attempts
  let sanitized = xss(input, xssOptions);
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  return sanitized;
};

// Sanitize object recursively
export const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'object' ? sanitizeObject(item) : sanitizeString(item)
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

// Common validation schemas
export const schemas = {
  // User authentication
  login: Joi.object({
    email: Joi.string().email().required().max(255),
    password: Joi.string().required().min(8).max(128)
  }),
  
  register: Joi.object({
    email: Joi.string().email().required().max(255),
    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.pattern.base': 'Password must contain uppercase, lowercase, number and special character'
      }),
    first_name: Joi.string().required().max(100).pattern(/^[a-zA-Z\s'-]+$/),
    last_name: Joi.string().required().max(100).pattern(/^[a-zA-Z\s'-]+$/),
    company_name: Joi.string().max(255),
    role: Joi.string().valid('sales_rep', 'manager', 'admin').default('sales_rep')
  }),
  
  // Password reset
  passwordReset: Joi.object({
    email: Joi.string().email().required().max(255)
  }),
  
  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required(),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
  }),
  
  // Deal management
  deal: Joi.object({
    deal_name: Joi.string().required().max(255),
    account_name: Joi.string().required().max(255),
    amount: Joi.number().positive().required().max(999999999.99),
    probability: Joi.number().integer().min(0).max(100),
    status: Joi.string().valid('open', 'closed_won', 'closed_lost'),
    stage: Joi.string().max(100),
    close_date: Joi.date().iso().required(),
    deal_type: Joi.string().valid('pipeline', 'commit', 'best_case', 'closed_won'),
    crm_id: Joi.string().max(255).allow(null, ''),
    owner_email: Joi.string().email().allow(null, '')
  }),
  
  dealCategorize: Joi.object({
    deal_type: Joi.string().valid('pipeline', 'commit', 'best_case', 'closed_won').required(),
    previous_category: Joi.string().valid('pipeline', 'commit', 'best_case', 'closed_won'),
    categorization_timestamp: Joi.date().iso(),
    user_context: Joi.object({
      confidence_level: Joi.string().valid('high', 'medium', 'low'),
      categorization_method: Joi.string(),
      session_id: Joi.string()
    })
  }),
  
  // Target management
  target: Joi.object({
    period_type: Joi.string().valid('monthly', 'quarterly', 'annual').required(),
    period_start: Joi.date().iso().required(),
    period_end: Joi.date().iso().required(),
    quota_amount: Joi.number().positive().required().max(999999999.99),
    commission_rate: Joi.number().positive().min(0).max(1).required(),
    user_id: Joi.string().uuid(),
    team_target: Joi.boolean().default(false),
    distribution_method: Joi.string().valid('even', 'seasonal', 'custom', 'one-time'),
    distribution_config: Joi.object().allow(null)
  }),
  
  // Commission management
  commissionApproval: Joi.object({
    action: Joi.string()
      .valid('review', 'approve', 'reject', 'request_change', 'pay', 'adjust_and_approve')
      .required(),
    notes: Joi.string().max(1000).allow(null, ''),
    adjustment_amount: Joi.number().positive().max(999999999.99).when('action', {
      is: 'adjust_and_approve',
      then: Joi.required()
    }),
    adjustment_reason: Joi.string().min(10).max(500).when('action', {
      is: 'adjust_and_approve',
      then: Joi.required()
    }),
    payment_reference: Joi.string().max(255).when('action', {
      is: 'pay',
      then: Joi.required()
    })
  }),
  
  // Team management
  teamMember: Joi.object({
    email: Joi.string().email().required().max(255),
    first_name: Joi.string().required().max(100),
    last_name: Joi.string().required().max(100),
    role: Joi.string().valid('sales_rep', 'manager').default('sales_rep'),
    is_manager: Joi.boolean().default(false),
    employee_id: Joi.string().max(100).allow(null, '')
  }),
  
  // Integration configuration
  integration: Joi.object({
    type: Joi.string().valid('google_sheets', 'salesforce', 'hubspot', 'pipedrive').required(),
    name: Joi.string().required().max(255),
    config: Joi.object().required(),
    is_active: Joi.boolean().default(true)
  }),
  
  // Data export request
  dataExport: Joi.object({
    format: Joi.string().valid('json', 'csv', 'excel').default('json'),
    include_deals: Joi.boolean().default(true),
    include_commissions: Joi.boolean().default(true),
    include_targets: Joi.boolean().default(true),
    include_team: Joi.boolean().default(false),
    date_from: Joi.date().iso(),
    date_to: Joi.date().iso()
  }),
  
  // Pagination
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().max(50),
    order: Joi.string().valid('asc', 'desc').default('desc')
  }),
  
  // Search/filter
  searchFilter: Joi.object({
    search: Joi.string().max(255).allow(''),
    status: Joi.string().max(50),
    from_date: Joi.date().iso(),
    to_date: Joi.date().iso(),
    min_amount: Joi.number().positive(),
    max_amount: Joi.number().positive(),
    user_id: Joi.string().uuid(),
    team_id: Joi.string().uuid()
  })
};

// Validation middleware factory
export const validate = (schema) => {
  return async (req, res, next) => {
    try {
      // Sanitize input first
      if (req.body) {
        req.body = sanitizeObject(req.body);
      }
      if (req.query) {
        req.query = sanitizeObject(req.query);
      }
      if (req.params) {
        req.params = sanitizeObject(req.params);
      }
      
      // Validate against schema
      const validationTarget = req.method === 'GET' ? req.query : req.body;
      const { error, value } = schema.validate(validationTarget, {
        abortEarly: false,
        stripUnknown: true
      });
      
      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));
        
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          errors
        });
      }
      
      // Replace with validated and sanitized data
      if (req.method === 'GET') {
        req.query = value;
      } else {
        req.body = value;
      }
      
      next();
    } catch (err) {
      console.error('Validation middleware error:', err);
      res.status(500).json({
        error: 'Internal validation error',
        code: 'INTERNAL_ERROR'
      });
    }
  };
};

// SQL injection prevention for raw queries
export const sanitizeSqlParam = (param) => {
  if (typeof param === 'string') {
    // Remove SQL keywords and special characters
    return param.replace(/['";\\]/g, '');
  }
  return param;
};

// File upload validation
export const validateFileUpload = (allowedTypes = ['image/jpeg', 'image/png', 'application/pdf']) => {
  return (req, res, next) => {
    if (!req.file) {
      return next();
    }
    
    // Check file type
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        error: 'Invalid file type',
        code: 'INVALID_FILE_TYPE',
        allowed: allowedTypes
      });
    }
    
    // Check file size (10MB default)
    const maxSize = parseInt(process.env.MAX_FILE_SIZE || '10485760');
    if (req.file.size > maxSize) {
      return res.status(400).json({
        error: 'File too large',
        code: 'FILE_TOO_LARGE',
        maxSize: `${maxSize / 1048576}MB`
      });
    }
    
    // Sanitize filename
    req.file.originalname = sanitizeString(req.file.originalname);
    
    next();
  };
};

// Email validation with DNS check (for production)
export const validateEmailDomain = async (email) => {
  if (!validator.isEmail(email)) {
    return false;
  }
  
  // In production, check if domain has MX records
  if (process.env.NODE_ENV === 'production') {
    const domain = email.split('@')[1];
    try {
      const dns = await import('dns').then(m => m.promises);
      const mxRecords = await dns.resolveMx(domain);
      return mxRecords && mxRecords.length > 0;
    } catch (error) {
      return false;
    }
  }
  
  return true;
};

// Check for common SQL injection patterns
export const detectSqlInjection = (input) => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE)\b)/gi,
    /(--|#|\/\*|\*\/)/g,
    /(\bOR\b\s*\d+\s*=\s*\d+)/gi,
    /(\bAND\b\s*\d+\s*=\s*\d+)/gi,
    /(';|";)/g
  ];
  
  if (typeof input === 'string') {
    for (const pattern of sqlPatterns) {
      if (pattern.test(input)) {
        return true;
      }
    }
  }
  
  return false;
};

// Middleware to detect and block SQL injection attempts
export const blockSqlInjection = (req, res, next) => {
  const checkValue = (value) => {
    if (typeof value === 'string' && detectSqlInjection(value)) {
      return true;
    }
    if (typeof value === 'object' && value !== null) {
      for (const val of Object.values(value)) {
        if (checkValue(val)) return true;
      }
    }
    return false;
  };
  
  if (checkValue(req.body) || checkValue(req.query) || checkValue(req.params)) {
    console.warn('SQL injection attempt detected:', {
      ip: req.ip,
      user: req.user?.email,
      path: req.path
    });
    
    return res.status(400).json({
      error: 'Invalid input detected',
      code: 'INVALID_INPUT'
    });
  }
  
  next();
};

// GDPR compliant data masking
export const maskSensitiveData = (data, fields = ['password', 'ssn', 'credit_card']) => {
  if (!data || typeof data !== 'object') return data;
  
  const masked = { ...data };
  for (const field of fields) {
    if (masked[field]) {
      masked[field] = '***REDACTED***';
    }
  }
  
  return masked;
};

export default {
  sanitizeString,
  sanitizeObject,
  schemas,
  validate,
  sanitizeSqlParam,
  validateFileUpload,
  validateEmailDomain,
  detectSqlInjection,
  blockSqlInjection,
  maskSensitiveData
};