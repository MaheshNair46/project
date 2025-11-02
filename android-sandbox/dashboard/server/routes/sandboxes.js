const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const yaml = require('yaml');

const router = express.Router();
const docker = require('../services/docker');
const { validateRequest } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const logger = require('../utils/logger');
const { Sandbox } = require('../models/Sandbox');

// Validation schemas
const createSandboxSchema = Joi.object({
  name: Joi.string().required().min(3).max(50),
  android_version: Joi.string().valid('11', '12', '13').default('12'),
  device_profile: Joi.string().default('pixel-5'),
  network_config: Joi.object({
    ip_address: Joi.string().ip().optional(),
    dns_servers: Joi.array().items(Joi.string()).optional(),
    proxy: Joi.string().uri().optional(),
    bandwidth_kbps: Joi.number().positive().optional(),
    latency_ms: Joi.number().min(0).optional(),
    packet_loss_percent: Joi.number().min(0).max(100).optional()
  }).optional(),
  analysis_tools: Joi.array().items(
    Joi.string().valid('frida', 'tcpdump', 'strace', 'logcat')
  ).default(['logcat']),
  security_policy: Joi.string().valid('analysis-mode', 'stealth-mode').default('analysis-mode'),
  auto_start: Joi.boolean().default(false),
  tags: Joi.array().items(Joi.string()).optional()
});

const updateSandboxSchema = Joi.object({
  name: Joi.string().min(3).max(50).optional(),
  network_config: Joi.object({
    ip_address: Joi.string().ip().optional(),
    dns_servers: Joi.array().items(Joi.string()).optional(),
    proxy: Joi.string().uri().optional(),
    bandwidth_kbps: Joi.number().positive().optional(),
    latency_ms: Joi.number().min(0).optional(),
    packet_loss_percent: Joi.number().min(0).max(100).optional()
  }).optional(),
  analysis_tools: Joi.array().items(
    Joi.string().valid('frida', 'tcpdump', 'strace', 'logcat')
  ).optional(),
  tags: Joi.array().items(Joi.string()).optional()
});

// GET /api/v1/sandboxes - List all sandboxes
router.get('/', authenticate, checkPermission('sandbox:read'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const offset = (page - 1) * limit;

    const sandboxes = await Sandbox.list({
      limit: parseInt(limit),
      offset: parseInt(offset),
      status,
      search,
      userId: req.user.id
    });

    const total = await Sandbox.count({ status, search, userId: req.user.id });

    res.json({
      success: true,
      data: {
        sandboxes,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error listing sandboxes:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list sandboxes'
      }
    });
  }
});

// GET /api/v1/sandboxes/:id - Get specific sandbox
router.get('/:id', authenticate, checkPermission('sandbox:read'), async (req, res) => {
  try {
    const { id } = req.params;
    const sandbox = await Sandbox.findById(id, req.user.id);

    if (!sandbox) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SANDBOX_NOT_FOUND',
          message: 'Sandbox not found'
        }
      });
    }

    // Get detailed status from Docker
    const containerInfo = await docker.getContainerInfo(id);
    const networkInfo = await docker.getContainerNetworkInfo(id);

    sandbox.container_info = containerInfo;
    sandbox.network_info = networkInfo;

    res.json({
      success: true,
      data: sandbox
    });
  } catch (error) {
    logger.error(`Error getting sandbox ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get sandbox'
      }
    });
  }
});

// POST /api/v1/sandboxes - Create new sandbox
router.post('/',
  authenticate,
  checkPermission('sandbox:create'),
  validateRequest({ body: createSandboxSchema }),
  async (req, res) => {
    try {
      const sandboxData = {
        id: uuidv4(),
        ...req.body,
        user_id: req.user.id,
        status: 'creating',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Check if user has reached their sandbox limit
      const activeSandboxes = await Sandbox.count({
        userId: req.user.id,
        status: ['running', 'starting']
      });

      const maxSandboxes = req.user.permissions.includes('admin') ? 20 : 5;
      if (activeSandboxes >= maxSandboxes) {
        return res.status(429).json({
          success: false,
          error: {
            code: 'SANDBOX_LIMIT_REACHED',
            message: `Maximum ${maxSandboxes} active sandboxes allowed`
          }
        });
      }

      // Create sandbox record
      const sandbox = await Sandbox.create(sandboxData);

      // Start Docker container creation
      try {
        logger.info(`Creating sandbox container for ${sandbox.id}`);

        const containerConfig = await docker.buildContainerConfig(sandboxData);
        const container = await docker.createContainer(sandbox.id, containerConfig);

        // Update sandbox with container info
        await Sandbox.update(sandbox.id, {
          container_id: container.id,
          status: 'starting'
        });

        // Start the container
        await docker.startContainer(container.id);

        // Get network information
        const networkInfo = await docker.getContainerNetworkInfo(container.id);

        // Update sandbox with network info
        await Sandbox.update(sandbox.id, {
          status: 'running',
          adb_port: networkInfo.adb_port,
          vnc_port: networkInfo.vnc_port,
          ip_address: networkInfo.ip_address,
          started_at: new Date().toISOString()
        });

        logger.info(`Sandbox ${sandbox.id} created and started successfully`);

        res.status(201).json({
          success: true,
          data: {
            id: sandbox.id,
            name: sandbox.name,
            status: 'running',
            adb_port: networkInfo.adb_port,
            vnc_port: networkInfo.vnc_port,
            ip_address: networkInfo.ip_address,
            created_at: sandbox.created_at
          }
        });

      } catch (dockerError) {
        logger.error(`Docker error creating sandbox ${sandbox.id}:`, dockerError);

        // Update sandbox status to failed
        await Sandbox.update(sandbox.id, {
          status: 'failed',
          error_message: dockerError.message,
          failed_at: new Date().toISOString()
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'DOCKER_ERROR',
            message: 'Failed to create sandbox container',
            details: dockerError.message
          }
        });
      }

    } catch (error) {
      logger.error('Error creating sandbox:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create sandbox'
        }
      });
    }
  }
);

// PUT /api/v1/sandboxes/:id - Update sandbox
router.put('/:id',
  authenticate,
  checkPermission('sandbox:update'),
  validateRequest({ body: updateSandboxSchema }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const sandbox = await Sandbox.findById(id, req.user.id);

      if (!sandbox) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'SANDBOX_NOT_FOUND',
            message: 'Sandbox not found'
          }
        });
      }

      if (sandbox.status === 'running') {
        // Update network configuration for running sandbox
        if (req.body.network_config) {
          await docker.updateNetworkConfig(id, req.body.network_config);
        }

        // Update analysis tools for running sandbox
        if (req.body.analysis_tools) {
          await docker.updateAnalysisTools(id, req.body.analysis_tools);
        }
      }

      // Update sandbox record
      const updatedSandbox = await Sandbox.update(id, {
        ...req.body,
        updated_at: new Date().toISOString()
      });

      res.json({
        success: true,
        data: updatedSandbox
      });

    } catch (error) {
      logger.error(`Error updating sandbox ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update sandbox'
        }
      });
    }
  }
);

// POST /api/v1/sandboxes/:id/start - Start sandbox
router.post('/:id/start', authenticate, checkPermission('sandbox:control'), async (req, res) => {
  try {
    const { id } = req.params;
    const sandbox = await Sandbox.findById(id, req.user.id);

    if (!sandbox) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SANDBOX_NOT_FOUND',
          message: 'Sandbox not found'
        }
      });
    }

    if (sandbox.status === 'running') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_RUNNING',
          message: 'Sandbox is already running'
        }
      });
    }

    await Sandbox.update(id, { status: 'starting' });
    await docker.startContainer(sandbox.container_id);

    const networkInfo = await docker.getContainerNetworkInfo(sandbox.container_id);

    await Sandbox.update(id, {
      status: 'running',
      adb_port: networkInfo.adb_port,
      vnc_port: networkInfo.vnc_port,
      ip_address: networkInfo.ip_address,
      started_at: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        id: sandbox.id,
        status: 'running',
        adb_port: networkInfo.adb_port,
        vnc_port: networkInfo.vnc_port,
        ip_address: networkInfo.ip_address
      }
    });

  } catch (error) {
    logger.error(`Error starting sandbox ${req.params.id}:`, error);

    await Sandbox.update(req.params.id, {
      status: 'failed',
      error_message: error.message,
      failed_at: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'START_ERROR',
        message: 'Failed to start sandbox'
      }
    });
  }
});

// POST /api/v1/sandboxes/:id/stop - Stop sandbox
router.post('/:id/stop', authenticate, checkPermission('sandbox:control'), async (req, res) => {
  try {
    const { id } = req.params;
    const sandbox = await Sandbox.findById(id, req.user.id);

    if (!sandbox) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SANDBOX_NOT_FOUND',
          message: 'Sandbox not found'
        }
      });
    }

    if (sandbox.status !== 'running') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NOT_RUNNING',
          message: 'Sandbox is not running'
        }
      });
    }

    await docker.stopContainer(sandbox.container_id);

    await Sandbox.update(id, {
      status: 'stopped',
      stopped_at: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        id: sandbox.id,
        status: 'stopped'
      }
    });

  } catch (error) {
    logger.error(`Error stopping sandbox ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STOP_ERROR',
        message: 'Failed to stop sandbox'
      }
    });
  }
});

// DELETE /api/v1/sandboxes/:id - Delete sandbox
router.delete('/:id', authenticate, checkPermission('sandbox:delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const sandbox = await Sandbox.findById(id, req.user.id);

    if (!sandbox) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SANDBOX_NOT_FOUND',
          message: 'Sandbox not found'
        }
      });
    }

    // Stop container if running
    if (sandbox.status === 'running') {
      await docker.stopContainer(sandbox.container_id);
    }

    // Remove container
    await docker.removeContainer(sandbox.container_id);

    // Remove network if custom
    await docker.removeCustomNetwork(id);

    // Delete sandbox record
    await Sandbox.delete(id);

    res.json({
      success: true,
      data: {
        id: sandbox.id,
        message: 'Sandbox deleted successfully'
      }
    });

  } catch (error) {
    logger.error(`Error deleting sandbox ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_ERROR',
        message: 'Failed to delete sandbox'
      }
    });
  }
});

// GET /api/v1/sandboxes/:id/logs - Get sandbox logs
router.get('/:id/logs', authenticate, checkPermission('sandbox:read'), async (req, res) => {
  try {
    const { id } = req.params;
    const { lines = 100, follow = false } = req.query;

    const sandbox = await Sandbox.findById(id, req.user.id);
    if (!sandbox) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SANDBOX_NOT_FOUND',
          message: 'Sandbox not found'
        }
      });
    }

    const logs = await docker.getContainerLogs(sandbox.container_id, {
      lines: parseInt(lines),
      follow: follow === 'true'
    });

    if (follow === 'true') {
      // Stream logs
      res.setHeader('Content-Type', 'text/plain');
      logs.pipe(res);
    } else {
      res.json({
        success: true,
        data: {
          logs: logs,
          sandbox_id: id
        }
      });
    }

  } catch (error) {
    logger.error(`Error getting logs for sandbox ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGS_ERROR',
        message: 'Failed to get sandbox logs'
      }
    });
  }
});

// POST /api/v1/sandboxes/:id/restart - Restart sandbox
router.post('/:id/restart', authenticate, checkPermission('sandbox:control'), async (req, res) => {
  try {
    const { id } = req.params;
    const sandbox = await Sandbox.findById(id, req.user.id);

    if (!sandbox) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SANDBOX_NOT_FOUND',
          message: 'Sandbox not found'
        }
      });
    }

    // Stop container
    await docker.restartContainer(sandbox.container_id);

    // Get updated network info
    const networkInfo = await docker.getContainerNetworkInfo(sandbox.container_id);

    await Sandbox.update(id, {
      status: 'running',
      adb_port: networkInfo.adb_port,
      vnc_port: networkInfo.vnc_port,
      ip_address: networkInfo.ip_address,
      restarted_at: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        id: sandbox.id,
        status: 'running',
        adb_port: networkInfo.adb_port,
        vnc_port: networkInfo.vnc_port,
        ip_address: networkInfo.ip_address
      }
    });

  } catch (error) {
    logger.error(`Error restarting sandbox ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RESTART_ERROR',
        message: 'Failed to restart sandbox'
      }
    });
  }
});

module.exports = router;