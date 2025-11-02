const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const logger = require('../utils/logger');
const { rateLimiter } = require('./rateLimiter');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://sandbox_admin:sandbox_password@postgres:5432/android_sandbox'
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Generate JWT token
function generateToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    permissions: user.permissions
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
}

// Authentication middleware
function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'Authorization token required'
        }
      });
    }

    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'Authorization token required'
        }
      });
    }

    const decoded = verifyToken(token);
    req.user = decoded;
    req.token = token;

    // Update last login time asynchronously
    updateLastLogin(decoded.id).catch(error => {
      logger.error('Error updating last login:', error);
    });

    next();
  } catch (error) {
    logger.error('Authentication error:', error);

    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token'
      }
    });
  }
}

// Optional authentication (doesn't fail if no token)
function optionalAuthenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const decoded = verifyToken(token);
      req.user = decoded;
      req.token = token;
    }

    next();
  } catch (error) {
    // Don't fail, just continue without authentication
    next();
  }
}

// Role-based authorization middleware
function authorize(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Authentication required'
        }
      });
    }

    const userRole = req.user.role;
    const hasRole = Array.isArray(roles) ? roles.includes(userRole) : roles === userRole;

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient role permissions'
        }
      });
    }

    next();
  };
}

// Permission-based authorization middleware
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Authentication required'
        }
      });
    }

    const userPermissions = req.user.permissions || [];
    const hasPermission = userPermissions.includes(permission);

    if (!hasPermission) {
      logger.warn(`Permission denied: user ${req.user.username} lacks permission ${permission}`, {
        userId: req.user.id,
        permission: permission,
        userPermissions: userPermissions
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Permission required: ${permission}`
        }
      });
    }

    next();
  };
}

// Resource ownership check
function requireOwnership(resourceType) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'NOT_AUTHENTICATED',
            message: 'Authentication required'
          }
        });
      }

      const resourceId = req.params.id;
      const userId = req.user.id;

      // Admin users can access any resource
      if (req.user.role === 'admin') {
        return next();
      }

      let isOwner = false;

      switch (resourceType) {
        case 'sandbox':
          isOwner = await checkSandboxOwnership(resourceId, userId);
          break;
        case 'analysis':
          isOwner = await checkAnalysisOwnership(resourceId, userId);
          break;
        case 'capture':
          isOwner = await checkCaptureOwnership(resourceId, userId);
          break;
        default:
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_RESOURCE_TYPE',
              message: 'Invalid resource type'
            }
          });
      }

      if (!isOwner) {
        logger.warn(`Access denied: user ${req.user.username} does not own ${resourceType} ${resourceId}`, {
          userId: req.user.id,
          resourceType: resourceType,
          resourceId: resourceId
        });

        return res.status(403).json({
          success: false,
          error: {
            code: 'RESOURCE_ACCESS_DENIED',
            message: 'Access denied: you do not own this resource'
          }
        });
      }

      next();
    } catch (error) {
      logger.error('Ownership check error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'OWNERSHIP_CHECK_ERROR',
          message: 'Error checking resource ownership'
        }
      });
    }
  };
}

// Check sandbox ownership
async function checkSandboxOwnership(sandboxId, userId) {
  try {
    const query = 'SELECT user_id FROM sandboxes WHERE id = $1';
    const result = await pool.query(query, [sandboxId]);

    if (result.rows.length === 0) {
      return false;
    }

    return result.rows[0].user_id === userId;
  } catch (error) {
    logger.error('Error checking sandbox ownership:', error);
    return false;
  }
}

// Check analysis ownership
async function checkAnalysisOwnership(analysisId, userId) {
  try {
    const query = `
      SELECT a.user_id
      FROM analysis_results a
      JOIN sandboxes s ON a.sandbox_id = s.id
      WHERE a.id = $1
    `;
    const result = await pool.query(query, [analysisId]);

    if (result.rows.length === 0) {
      return false;
    }

    return result.rows[0].user_id === userId;
  } catch (error) {
    logger.error('Error checking analysis ownership:', error);
    return false;
  }
}

// Check capture ownership
async function checkCaptureOwnership(captureId, userId) {
  try {
    const query = `
      SELECT c.sandbox_id, s.user_id
      FROM network_captures c
      JOIN sandboxes s ON c.sandbox_id = s.id
      WHERE c.id = $1
    `;
    const result = await pool.query(query, [captureId]);

    if (result.rows.length === 0) {
      return false;
    }

    return result.rows[0].user_id === userId;
  } catch (error) {
    logger.error('Error checking capture ownership:', error);
    return false;
  }
}

// Update last login time
async function updateLastLogin(userId) {
  try {
    const query = 'UPDATE users SET last_login = NOW() WHERE id = $1';
    await pool.query(query, [userId]);
  } catch (error) {
    logger.error('Error updating last login:', error);
  }
}

// Session management
function createSession(user, req) {
  const sessionData = {
    userId: user.id,
    username: user.username,
    role: user.role,
    loginTime: new Date(),
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  };

  return sessionData;
}

// Rate limiting for authentication
const authRateLimiter = rateLimiter.create({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later'
    }
  }
});

// Password validation
function validatePassword(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const errors = [];

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  if (!hasUpperCase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!hasLowerCase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!hasNumbers) {
    errors.push('Password must contain at least one number');
  }
  if (!hasSpecialChar) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Token refresh
function refreshToken(req, res) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_REFRESH_TOKEN',
          message: 'Refresh token required'
        }
      });
    }

    const decoded = verifyToken(refreshToken);

    // Generate new access token
    const newToken = generateToken({
      id: decoded.id,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions
    });

    res.json({
      success: true,
      data: {
        token: newToken,
        expiresIn: JWT_EXPIRES_IN
      }
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid or expired refresh token'
      }
    });
  }
}

// Logout
function logout(req, res) {
  // In a real implementation, you would:
  // 1. Add the token to a blacklist
  // 2. Remove the session from Redis
  // 3. Log the logout event

  logger.info(`User ${req.user.username} logged out`, {
    userId: req.user.id,
    ipAddress: req.ip
  });

  res.json({
    success: true,
    data: {
      message: 'Logged out successfully'
    }
  });
}

module.exports = {
  generateToken,
  verifyToken,
  authenticate,
  optionalAuthenticate,
  authorize,
  requirePermission,
  requireOwnership,
  createSession,
  authRateLimiter,
  validatePassword,
  refreshToken,
  logout,
  JWT_SECRET,
  JWT_EXPIRES_IN
};