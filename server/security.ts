import { Express, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import validator from 'validator';
import { randomBytes } from 'crypto';

// ============================================================================
// CSRF Protection (Double Submit Cookie Pattern)
// ============================================================================

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Setup CSRF protection middleware using Double Submit Cookie pattern
 * This pattern works well with SPAs and doesn't require server-side session storage
 */
export function setupCsrfProtection(app: Express) {
  // Middleware to set CSRF cookie on every response
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Only set cookie if not already present
    if (!req.cookies?.[CSRF_COOKIE_NAME]) {
      const token = generateCsrfToken();
      res.cookie(CSRF_COOKIE_NAME, token, {
        httpOnly: false, // Must be readable by JS for double submit
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
    }
    next();
  });

  // Middleware to validate CSRF token on state-changing requests
  app.use((req: Request, res: Response, next: NextFunction) => {
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];

    // Skip CSRF check for safe methods
    if (safeMethods.includes(req.method)) {
      return next();
    }

    // Skip CSRF check for API endpoints that use other auth (e.g., webhook callbacks)
    const csrfExemptPaths = [
      '/api/health',
      '/api/webhook', // External webhook callbacks
    ];

    if (csrfExemptPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = req.headers[CSRF_HEADER_NAME] as string;

    // Validate CSRF token
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      console.warn(`🚨 CSRF validation failed for ${req.method} ${req.path} from IP: ${req.ip}`);
      return res.status(403).json({
        error: 'CSRF token validation failed',
        message: 'Request rejected due to security validation failure'
      });
    }

    next();
  });
}

/**
 * Get current CSRF token endpoint for frontend
 */
export function setupCsrfTokenEndpoint(app: Express) {
  app.get('/api/csrf-token', (req: Request, res: Response) => {
    let token = req.cookies?.[CSRF_COOKIE_NAME];

    if (!token) {
      token = generateCsrfToken();
      res.cookie(CSRF_COOKIE_NAME, token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000
      });
    }

    res.json({ csrfToken: token });
  });
}

// ============================================================================
// Security Headers
// ============================================================================

export function setupSecurityHeaders(app: Express) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Protection contre les attaques XSS
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Protection HTTPS
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    // Politique de sécurité du contenu (renforcée)
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "connect-src 'self' ws: wss:; " +
      "font-src 'self' data:; " +
      "form-action 'self';" // Prevent form submissions to external sites
    );

    // Protection contre les attaques de référence
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Protection des données sensibles
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    next();
  });
}

// ============================================================================
// Rate Limiting
// ============================================================================

export function setupRateLimiting(app: Express) {
  // Limiteur général
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limite chaque IP à 1000 requêtes par fenêtre
    message: {
      error: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      return req.path === '/api/health';
    }
  });

  // Limiteur pour l'authentification (strict)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limite les tentatives de connexion
    message: {
      error: 'Trop de tentatives de connexion, veuillez réessayer plus tard.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Limiteur pour l'API
  const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: process.env.NODE_ENV === 'development' ? 500 : 300,
    message: {
      error: 'Limite API atteinte, veuillez ralentir vos requêtes.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      return req.path === '/api/health' || req.path === '/api/user';
    },
    handler: (req, res) => {
      console.warn(`🚨 Rate limit reached for IP: ${req.ip} on path: ${req.path} at ${new Date().toISOString()}`);
      res.status(429).json({
        error: 'Limite API atteinte, veuillez ralentir vos requêtes.',
      });
    }
  });

  app.use(generalLimiter);
  app.use('/api/login', authLimiter);
  app.use('/api/', apiLimiter);
}

// ============================================================================
// Input Sanitization (Using validator.js)
// ============================================================================

/**
 * Sanitize a single string value using validator.js
 * Protects against XSS, SQL injection patterns, and path traversal
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return input;

  let sanitized = input.trim();

  // Escape HTML entities to prevent XSS
  sanitized = validator.escape(sanitized);

  // Remove null bytes (used in some injection attacks)
  sanitized = sanitized.replace(/\0/g, '');

  // Remove path traversal attempts
  sanitized = sanitized.replace(/\.\.\//g, '').replace(/\.\.\\/g, '');

  return sanitized;
}

/**
 * Recursively sanitize all string values in an object
 */
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return sanitizeString(input);
  }

  if (Array.isArray(input)) {
    return input.map(item => sanitizeInput(item));
  }

  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const key in input) {
      // Also sanitize object keys to prevent prototype pollution
      const sanitizedKey = sanitizeString(key);
      if (sanitizedKey === '__proto__' || sanitizedKey === 'constructor' || sanitizedKey === 'prototype') {
        continue; // Skip prototype pollution attempts
      }
      sanitized[sanitizedKey] = sanitizeInput(input[key]);
    }
    return sanitized;
  }

  return input;
}

/**
 * Validate and sanitize email
 */
export function sanitizeEmail(email: string): string | null {
  if (!email || typeof email !== 'string') return null;

  const normalized = validator.normalizeEmail(email);
  if (!normalized || !validator.isEmail(normalized)) {
    return null;
  }

  return normalized;
}

/**
 * Validate and sanitize URL
 */
export function sanitizeUrl(url: string): string | null {
  if (!url || typeof url !== 'string') return null;

  if (!validator.isURL(url, {
    protocols: ['http', 'https'],
    require_protocol: true,
    require_valid_protocol: true
  })) {
    return null;
  }

  return url;
}

/**
 * Check for SQL injection patterns (for logging/monitoring)
 */
export function detectSqlInjection(input: string): boolean {
  if (typeof input !== 'string') return false;

  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|UNION|OR|AND)\b.*\b(FROM|INTO|TABLE|WHERE|SET)\b)/i,
    /(['"]?\s*(OR|AND)\s*['"]?\s*['"]?\s*=\s*['"]?)/i,
    /(--|\#|\/\*|\*\/)/,
    /(\bEXEC\b|\bEXECUTE\b|\bxp_)/i,
  ];

  return sqlPatterns.some(pattern => pattern.test(input));
}

// Middleware de nettoyage des requêtes
export function setupInputSanitization(app: Express) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Log potential SQL injection attempts
    const checkAndLog = (data: any, source: string) => {
      if (typeof data === 'object' && data !== null) {
        for (const key in data) {
          const value = data[key];
          if (typeof value === 'string' && detectSqlInjection(value)) {
            console.warn(`🚨 Potential SQL injection detected in ${source}:`, {
              ip: req.ip,
              path: req.path,
              key,
              value: value.substring(0, 100) // Truncate for logging
            });
          }
        }
      }
    };

    if (req.body) {
      checkAndLog(req.body, 'body');
      req.body = sanitizeInput(req.body);
    }
    if (req.query) {
      checkAndLog(req.query, 'query');
      req.query = sanitizeInput(req.query);
    }
    if (req.params) {
      checkAndLog(req.params, 'params');
      req.params = sanitizeInput(req.params);
    }
    next();
  });
}

// ============================================================================
// Secure Logging
// ============================================================================

const SENSITIVE_KEYS = ['password', 'token', 'secret', 'apikey', 'api_key', 'authorization', 'cookie'];

export function secureLog(message: string, data?: any) {
  const timestamp = new Date().toISOString();

  // Mask sensitive data
  const maskSensitive = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;

    const masked: any = Array.isArray(obj) ? [] : {};
    for (const key in obj) {
      if (SENSITIVE_KEYS.some(s => key.toLowerCase().includes(s))) {
        masked[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        masked[key] = maskSensitive(obj[key]);
      } else {
        masked[key] = obj[key];
      }
    }
    return masked;
  };

  const logData = data ? JSON.stringify(maskSensitive(data), null, 2) : '';

  // Check message for sensitive content
  if (SENSITIVE_KEYS.some(s => message.toLowerCase().includes(s))) {
    console.log(`[${timestamp}] ${message} - [SENSITIVE DATA HIDDEN]`);
  } else {
    console.log(`[${timestamp}] ${message}`, logData);
  }
}