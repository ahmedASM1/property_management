// Enhanced Authentication Security Utilities
import { NextRequest } from 'next/server';
import { headers } from 'next/headers';

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  login: { maxAttempts: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 minutes
  passwordReset: { maxAttempts: 3, windowMs: 60 * 60 * 1000 }, // 3 attempts per hour
  magicLink: { maxAttempts: 3, windowMs: 60 * 60 * 1000 }, // 3 attempts per hour
};

// In-memory rate limiting store (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

/**
 * Check if request is within rate limits
 */
export function checkRateLimit(
  identifier: string,
  type: keyof typeof RATE_LIMIT_CONFIG
): RateLimitResult {
  const config = RATE_LIMIT_CONFIG[type];
  const now = Date.now();
  const key = `${type}:${identifier}`;
  
  const current = rateLimitStore.get(key);
  
  if (!current || now > current.resetTime) {
    // Reset or create new entry
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs
    });
    
    return {
      allowed: true,
      remaining: config.maxAttempts - 1,
      resetTime: now + config.windowMs
    };
  }
  
  if (current.count >= config.maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: current.resetTime
    };
  }
  
  // Increment count
  current.count++;
  rateLimitStore.set(key, current);
  
  return {
    allowed: true,
    remaining: config.maxAttempts - current.count,
    resetTime: current.resetTime
  };
}

/**
 * Get client IP address from request
 */
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  return request.ip || 'unknown';
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;
  
  // Length check
  if (password.length < 8) {
    feedback.push('Password must be at least 8 characters long');
  } else {
    score += 1;
  }
  
  // Uppercase check
  if (!/[A-Z]/.test(password)) {
    feedback.push('Password must contain at least one uppercase letter');
  } else {
    score += 1;
  }
  
  // Lowercase check
  if (!/[a-z]/.test(password)) {
    feedback.push('Password must contain at least one lowercase letter');
  } else {
    score += 1;
  }
  
  // Number check
  if (!/\d/.test(password)) {
    feedback.push('Password must contain at least one number');
  } else {
    score += 1;
  }
  
  // Special character check
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    feedback.push('Password must contain at least one special character');
  } else {
    score += 1;
  }
  
  // Common password check
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123',
    'password123', 'admin', 'letmein', 'welcome', 'monkey'
  ];
  
  if (commonPasswords.includes(password.toLowerCase())) {
    feedback.push('Password is too common, please choose a more unique password');
    score = Math.max(0, score - 2);
  }
  
  return {
    isValid: score >= 4 && feedback.length === 0,
    score,
    feedback
  };
}

/**
 * Generate secure session token
 */
export function generateSecureToken(length: number = 32): string {
  const crypto = require('crypto');
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize user input
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .substring(0, 255); // Limit length
}

/**
 * Check for suspicious activity patterns
 */
export function detectSuspiciousActivity(
  ip: string,
  userAgent: string,
  email: string
): { suspicious: boolean; reason?: string } {
  // Check for common bot patterns
  const botPatterns = [
    /bot/i, /crawler/i, /spider/i, /scraper/i, /curl/i, /wget/i
  ];
  
  if (botPatterns.some(pattern => pattern.test(userAgent))) {
    return { suspicious: true, reason: 'Bot-like user agent detected' };
  }
  
  // Check for rapid requests from same IP
  const rapidRequestKey = `rapid:${ip}`;
  const rapidRequest = rateLimitStore.get(rapidRequestKey);
  
  if (rapidRequest && rapidRequest.count > 10) {
    return { suspicious: true, reason: 'Rapid requests detected' };
  }
  
  return { suspicious: false };
}

/**
 * Generate CSRF token
 */
export function generateCSRFToken(): string {
  return generateSecureToken(16);
}

/**
 * Validate CSRF token
 */
export function validateCSRFToken(token: string, sessionToken: string): boolean {
  // In a real implementation, you'd store and validate against session
  return token === sessionToken;
}

/**
 * Security headers for API responses
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  };
}

/**
 * Log security events
 */
export function logSecurityEvent(
  event: string,
  details: Record<string, any>,
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    severity,
    details,
    environment: process.env.NODE_ENV
  };
  
  // In production, send to logging service
  console.log(`[SECURITY-${severity.toUpperCase()}]`, logEntry);
  
  // For critical events, you might want to send alerts
  if (severity === 'critical') {
    // Send alert to admin/security team
    console.error('CRITICAL SECURITY EVENT:', logEntry);
  }
}

/**
 * Session management utilities
 */
export class SessionManager {
  private static sessions = new Map<string, { userId: string; expiresAt: number; lastActivity: number }>();
  
  static createSession(userId: string, duration: number = 8 * 60 * 60 * 1000): string {
    const sessionId = generateSecureToken(32);
    const expiresAt = Date.now() + duration;
    
    this.sessions.set(sessionId, {
      userId,
      expiresAt,
      lastActivity: Date.now()
    });
    
    return sessionId;
  }
  
  static validateSession(sessionId: string): { valid: boolean; userId?: string } {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return { valid: false };
    }
    
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionId);
      return { valid: false };
    }
    
    // Update last activity
    session.lastActivity = Date.now();
    this.sessions.set(sessionId, session);
    
    return { valid: true, userId: session.userId };
  }
  
  static destroySession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
  
  static cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(sessionId);
      }
    }
  }
}

// Cleanup expired sessions every hour
setInterval(() => {
  SessionManager.cleanupExpiredSessions();
}, 60 * 60 * 1000);

