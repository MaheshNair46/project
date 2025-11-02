const express = require('express');
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');

const router = express.Router();
const {
  generateToken,
  verifyToken,
  authRateLimiter,
  validatePassword,
  refreshToken,
  logout
} = require('../middleware/auth');
const { hasPermission, isValidRole, getRolePermissions } = require('../middleware/permissions');
const { validateRequest } = require('../middleware/validation');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://sandbox_admin:sandbox_password@postgres:5432/android_sandbox'
});

// Validation schemas
const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid('admin', 'analyst', 'viewer').default('analyst'),
  permissions: Joi.array().items(Joi.string()).optional()
});

const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required(),
  remember: Joi.boolean().default(false)
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required()
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required()
});

const updateUserSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).optional(),
  email: Joi.string().email().optional(),
  role: Joi.string().valid('admin', 'analyst', 'viewer').optional(),
  permissions: Joi.array().items(Joi.string()).optional(),
  isActive: Joi.boolean().optional()
});

// POST /api/v1/auth/register - Register new user
router.post('/register',
  authRateLimiter,
  validateRequest({ body: registerSchema }),
  async (req, res) => {
    try {
      const { username, email, password, role, permissions } = req.body;

      // Check if user already exists
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE username = $1 OR email = $2',
        [username, email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'USER_EXISTS',
            message: 'Username or email already exists'
          }
        });
      }

      // Validate password strength
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'WEAK_PASSWORD',
            message: 'Password does not meet security requirements',
            details: passwordValidation.errors
          }
        });
      }

      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Determine permissions
      let userPermissions = permissions;
      if (!userPermissions || userPermissions.length === 0) {
        userPermissions = getRolePermissions(role);
      }

      // Create user
      const result = await pool.query(
        `INSERT INTO users (username, email, password_hash, role, permissions, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
         RETURNING id, username, email, role, permissions, created_at`,
        [username, email, passwordHash, role, userPermissions]
      );

      const user = result.rows[0];

      // Log registration
      logger.info(`New user registered: ${username}`, {
        userId: user.id,
        role: user.role,
        ipAddress: req.ip
      });

      // Generate token
      const token = generateToken(user);

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            permissions: user.permissions,
            created_at: user.created_at
          },
          token,
          expiresIn: '24h'
        }
      });

    } catch (error) {
      logger.error('Registration error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'REGISTRATION_ERROR',
          message: 'Failed to register user'
        }
      });
    }
  }
);

// POST /api/v1/auth/login - User login
router.post('/login',
  authRateLimiter,
  validateRequest({ body: loginSchema }),
  async (req, res) => {
    try {
      const { username, password, remember } = req.body;

      // Find user
      const result = await pool.query(
        'SELECT id, username, email, password_hash, role, permissions, is_active, last_login FROM users WHERE username = $1 OR email = $1',
        [username]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid username or password'
          }
        });
      }

      const user = result.rows[0];

      // Check if user is active
      if (!user.is_active) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'ACCOUNT_DISABLED',
            message: 'Account has been disabled'
          }
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid username or password'
          }
        });
      }

      // Update last login
      await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

      // Generate token
      const expiresIn = remember ? '7d' : '24h';
      const token = generateToken({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: user.permissions
      });

      // Log successful login
      logger.info(`User logged in: ${username}`, {
        userId: user.id,
        role: user.role,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            permissions: user.permissions,
            last_login: new Date().toISOString()
          },
          token,
          expiresIn
        }
      });

    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'LOGIN_ERROR',
          message: 'Failed to authenticate user'
        }
      });
    }
  }
);

// POST /api/v1/auth/refresh - Refresh access token
router.post('/refresh',
  validateRequest({ body: refreshTokenSchema }),
  refreshToken
);

// POST /api/v1/auth/logout - User logout
router.post('/logout', logout);

// GET /api/v1/auth/me - Get current user info
router.get('/me', async (req, res) => {
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
    const decoded = verifyToken(token);

    // Get fresh user data
    const result = await pool.query(
      'SELECT id, username, email, role, permissions, is_active, last_login, created_at FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'ACCOUNT_DISABLED',
          message: 'Account has been disabled'
        }
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          permissions: user.permissions,
          last_login: user.last_login,
          created_at: user.created_at
        }
      }
    });

  } catch (error) {
    logger.error('Get user info error:', error);
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token'
      }
    });
  }
});

// PUT /api/v1/auth/change-password - Change user password
router.put('/change-password',
  validateRequest({ body: changePasswordSchema }),
  async (req, res) => {
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
      const decoded = verifyToken(token);
      const { currentPassword, newPassword } = req.body;

      // Get user with password
      const result = await pool.query(
        'SELECT id, username, password_hash FROM users WHERE id = $1',
        [decoded.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          }
        });
      }

      const user = result.rows[0];

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValidPassword) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CURRENT_PASSWORD',
            message: 'Current password is incorrect'
          }
        });
      }

      // Validate new password
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'WEAK_PASSWORD',
            message: 'New password does not meet security requirements',
            details: passwordValidation.errors
          }
        });
      }

      // Check if new password is same as current
      const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
      if (isSamePassword) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'SAME_PASSWORD',
            message: 'New password must be different from current password'
          }
        });
      }

      // Hash new password
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await pool.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [newPasswordHash, user.id]
      );

      // Log password change
      logger.info(`Password changed for user: ${user.username}`, {
        userId: user.id,
        ipAddress: req.ip
      });

      res.json({
        success: true,
        data: {
          message: 'Password changed successfully'
        }
      });

    } catch (error) {
      logger.error('Change password error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'PASSWORD_CHANGE_ERROR',
          message: 'Failed to change password'
        }
      });
    }
  }
);

// GET /api/v1/auth/permissions - Get all available permissions
router.get('/permissions', async (req, res) => {
  try {
    const { getAllPermissions } = require('../middleware/permissions');
    const permissions = getAllPermissions();

    res.json({
      success: true,
      data: permissions
    });

  } catch (error) {
    logger.error('Get permissions error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PERMISSIONS_ERROR',
        message: 'Failed to get permissions'
      }
    });
  }
});

// GET /api/v1/auth/roles - Get all available roles
router.get('/roles', async (req, res) => {
  try {
    const { getAllRoles } = require('../middleware/permissions');
    const roles = getAllRoles();

    res.json({
      success: true,
      data: roles
    });

  } catch (error) {
    logger.error('Get roles error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROLES_ERROR',
        message: 'Failed to get roles'
      }
    });
  }
});

// POST /api/v1/auth/verify-token - Verify token validity
router.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'Token is required'
        }
      });
    }

    const decoded = verifyToken(token);

    res.json({
      success: true,
      data: {
        valid: true,
        user: {
          id: decoded.id,
          username: decoded.username,
          role: decoded.role,
          permissions: decoded.permissions
        }
      }
    });

  } catch (error) {
    res.json({
      success: true,
      data: {
        valid: false,
        error: error.message
      }
    });
  }
});

module.exports = router;