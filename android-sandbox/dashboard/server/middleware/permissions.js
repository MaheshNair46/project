// Permission System Middleware
// Defines permissions and provides permission checking utilities

// Permission definitions
const PERMISSIONS = {
  // Sandbox permissions
  'sandbox:read': 'Read sandbox information',
  'sandbox:create': 'Create new sandboxes',
  'sandbox:update': 'Update sandbox configuration',
  'sandbox:delete': 'Delete sandboxes',
  'sandbox:control': 'Start/stop/restart sandboxes',
  'sandbox:logs': 'View sandbox logs',

  // Network permissions
  'network:read': 'View network configuration',
  'network:update': 'Update network settings',
  'network:capture': 'Start/stop network captures',
  'network:simulate': 'Simulate network conditions',

  // Analysis permissions
  'analysis:read': 'View analysis results',
  'analysis:create': 'Create analysis tasks',
  'analysis:run': 'Run analysis tools',
  'analysis:export': 'Export analysis data',

  // Configuration permissions
  'config:read': 'View configuration templates',
  'config:create': 'Create configuration templates',
  'config:update': 'Update configuration templates',
  'config:delete': 'Delete configuration templates',

  // User management permissions
  'user:read': 'View user information',
  'user:create': 'Create users',
  'user:update': 'Update user information',
  'user:delete': 'Delete users',
  'user:manage_permissions': 'Manage user permissions',

  // Monitoring permissions
  'monitoring:read': 'View system monitoring data',
  'monitoring:alerts': 'Manage alert configurations',
  'monitoring:logs': 'View system logs',

  // System permissions
  'system:admin': 'Full system administration',
  'system:backup': 'Create system backups',
  'system:restore': 'Restore system from backup',
  'system:maintenance': 'Perform system maintenance'
};

// Role definitions with their permissions
const ROLES = {
  'admin': [
    // All permissions
    'sandbox:read', 'sandbox:create', 'sandbox:update', 'sandbox:delete', 'sandbox:control', 'sandbox:logs',
    'network:read', 'network:update', 'network:capture', 'network:simulate',
    'analysis:read', 'analysis:create', 'analysis:run', 'analysis:export',
    'config:read', 'config:create', 'config:update', 'config:delete',
    'user:read', 'user:create', 'user:update', 'user:delete', 'user:manage_permissions',
    'monitoring:read', 'monitoring:alerts', 'monitoring:logs',
    'system:admin', 'system:backup', 'system:restore', 'system:maintenance'
  ],
  'analyst': [
    // Sandbox permissions
    'sandbox:read', 'sandbox:create', 'sandbox:update', 'sandbox:control', 'sandbox:logs',
    // Network permissions (excluding delete/update of system configs)
    'network:read', 'network:capture', 'network:simulate',
    // Analysis permissions
    'analysis:read', 'analysis:create', 'analysis:run', 'analysis:export',
    // Configuration permissions (read-only)
    'config:read',
    // Monitoring permissions
    'monitoring:read'
  ],
  'viewer': [
    // Read-only permissions
    'sandbox:read', 'sandbox:logs',
    'network:read',
    'analysis:read',
    'config:read',
    'monitoring:read'
  ],
  'guest': [
    // Limited read permissions
    'sandbox:read',
    'analysis:read'
  ]
};

// Permission categories for UI organization
const PERMISSION_CATEGORIES = {
  'Sandbox Management': [
    'sandbox:read', 'sandbox:create', 'sandbox:update', 'sandbox:delete', 'sandbox:control', 'sandbox:logs'
  ],
  'Network Configuration': [
    'network:read', 'network:update', 'network:capture', 'network:simulate'
  ],
  'Analysis Tools': [
    'analysis:read', 'analysis:create', 'analysis:run', 'analysis:export'
  ],
  'Configuration Management': [
    'config:read', 'config:create', 'config:update', 'config:delete'
  ],
  'User Management': [
    'user:read', 'user:create', 'user:update', 'user:delete', 'user:manage_permissions'
  ],
  'System Monitoring': [
    'monitoring:read', 'monitoring:alerts', 'monitoring:logs'
  ],
  'System Administration': [
    'system:admin', 'system:backup', 'system:restore', 'system:maintenance'
  ]
};

// Check if user has permission
function hasPermission(user, permission) {
  if (!user || !user.permissions) {
    return false;
  }

  // Admin role has all permissions
  if (user.role === 'admin') {
    return true;
  }

  return user.permissions.includes(permission);
}

// Check if user has any of the specified permissions
function hasAnyPermission(user, permissions) {
  if (!user || !user.permissions) {
    return false;
  }

  // Admin role has all permissions
  if (user.role === 'admin') {
    return true;
  }

  return permissions.some(permission => user.permissions.includes(permission));
}

// Check if user has all specified permissions
function hasAllPermissions(user, permissions) {
  if (!user || !user.permissions) {
    return false;
  }

  // Admin role has all permissions
  if (user.role === 'admin') {
    return true;
  }

  return permissions.every(permission => user.permissions.includes(permission));
}

// Get user permissions with descriptions
function getUserPermissions(user) {
  if (!user || !user.permissions) {
    return [];
  }

  return user.permissions.map(permission => ({
    name: permission,
    description: PERMISSIONS[permission] || 'Unknown permission',
    category: getPermissionCategory(permission)
  }));
}

// Get permission category
function getPermissionCategory(permission) {
  for (const [category, permissions] of Object.entries(PERMISSION_CATEGORIES)) {
    if (permissions.includes(permission)) {
      return category;
    }
  }
  return 'Other';
}

// Get all permissions grouped by category
function getAllPermissions() {
  const result = {};

  for (const [category, permissions] of Object.entries(PERMISSION_CATEGORIES)) {
    result[category] = permissions.map(permission => ({
      name: permission,
      description: PERMISSIONS[permission] || 'Unknown permission'
    }));
  }

  return result;
}

// Get role permissions
function getRolePermissions(role) {
  return ROLES[role] || [];
}

// Get all roles with their permissions
function getAllRoles() {
  const result = {};

  for (const [role, permissions] of Object.entries(ROLES)) {
    result[role] = {
      permissions: permissions,
      permissionDetails: permissions.map(permission => ({
        name: permission,
        description: PERMISSIONS[permission] || 'Unknown permission',
        category: getPermissionCategory(permission)
      }))
    };
  }

  return result;
}

// Validate permission
function isValidPermission(permission) {
  return Object.keys(PERMISSIONS).includes(permission);
}

// Validate role
function isValidRole(role) {
  return Object.keys(ROLES).includes(role);
}

// Get permissions for route based on HTTP method and resource
function getRequiredPermissions(method, resource) {
  const permissions = {
    // Sandbox permissions
    'GET:/sandboxes': ['sandbox:read'],
    'POST:/sandboxes': ['sandbox:create'],
    'PUT:/sandboxes': ['sandbox:update'],
    'DELETE:/sandboxes': ['sandbox:delete'],
    'POST:/sandboxes/start': ['sandbox:control'],
    'POST:/sandboxes/stop': ['sandbox:control'],
    'POST:/sandboxes/restart': ['sandbox:control'],
    'GET:/sandboxes/logs': ['sandbox:logs'],

    // Network permissions
    'GET:/network': ['network:read'],
    'PUT:/network': ['network:update'],
    'POST:/network/capture': ['network:capture'],
    'DELETE:/network/capture': ['network:capture'],
    'POST:/network/simulate': ['network:simulate'],

    // Analysis permissions
    'GET:/analysis': ['analysis:read'],
    'POST:/analysis': ['analysis:create'],
    'POST:/analysis/run': ['analysis:run'],
    'GET:/analysis/export': ['analysis:export'],

    // Configuration permissions
    'GET:/config': ['config:read'],
    'POST:/config': ['config:create'],
    'PUT:/config': ['config:update'],
    'DELETE:/config': ['config:delete'],

    // User permissions
    'GET:/users': ['user:read'],
    'POST:/users': ['user:create'],
    'PUT:/users': ['user:update'],
    'DELETE:/users': ['user:delete'],
    'PUT:/users/permissions': ['user:manage_permissions'],

    // Monitoring permissions
    'GET:/monitoring': ['monitoring:read'],
    'POST:/monitoring/alerts': ['monitoring:alerts'],
    'GET:/monitoring/logs': ['monitoring:logs'],

    // System permissions
    'POST:/system/backup': ['system:backup'],
    'POST:/system/restore': ['system:restore'],
    'POST:/system/maintenance': ['system:maintenance']
  };

  const key = `${method}:${resource}`;
  return permissions[key] || [];
}

// Middleware to check permissions for routes
function checkPermissions(method, resource) {
  const requiredPermissions = getRequiredPermissions(method, resource);

  return (req, res, next) => {
    // If no permissions are required, allow access
    if (requiredPermissions.length === 0) {
      return next();
    }

    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Authentication required'
        }
      });
    }

    // Check if user has required permissions
    if (hasAllPermissions(req.user, requiredPermissions)) {
      return next();
    }

    // Log permission denied
    console.warn(`Permission denied: user ${req.user.username} lacks permissions for ${method} ${resource}`, {
      userId: req.user.id,
      requiredPermissions,
      userPermissions: req.user.permissions
    });

    return res.status(403).json({
      success: false,
      error: {
        code: 'INSUFFICIENT_PERMISSIONS',
        message: `Insufficient permissions for ${method} ${resource}`,
        required: requiredPermissions
      }
    });
  };
}

// Permission-based middleware factory
function requirePermissions(permissions) {
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

    if (hasAllPermissions(req.user, permissions)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: {
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Insufficient permissions',
        required: permissions
      }
    });
  };
}

// Role-based middleware factory
function requireRole(roles) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

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

    if (allowedRoles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: {
        code: 'INSUFFICIENT_ROLE',
        message: 'Insufficient role permissions',
        required: allowedRoles
      }
    });
  };
}

// Resource ownership check
function requireOwnership(resourceType, resourceIdParam = 'id') {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Authentication required'
        }
      });
    }

    // Admin can access any resource
    if (req.user.role === 'admin') {
      return next();
    }

    const resourceId = req.params[resourceIdParam];
    const userId = req.user.id;

    try {
      // Import the appropriate ownership checking function
      const { checkResourceOwnership } = require('../utils/ownership');
      const isOwner = await checkResourceOwnership(resourceType, resourceId, userId);

      if (!isOwner) {
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
      console.error('Ownership check error:', error);
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

module.exports = {
  PERMISSIONS,
  ROLES,
  PERMISSION_CATEGORIES,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getUserPermissions,
  getAllPermissions,
  getRolePermissions,
  getAllRoles,
  isValidPermission,
  isValidRole,
  getRequiredPermissions,
  checkPermissions,
  requirePermissions,
  requireRole,
  requireOwnership,
  getPermissionCategory
};