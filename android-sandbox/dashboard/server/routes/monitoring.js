const express = require('express');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs').promises;
const { Pool } = require('pg');
const docker = require('../services/docker');

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://sandbox_admin:sandbox_password@postgres:5432/android_sandbox'
});

// GET /api/v1/monitoring/health - System health check
router.get('/health', async (req, res) => {
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {},
      resources: {},
      sandboxes: {}
    };

    // Check database connection
    try {
      const dbResult = await pool.query('SELECT 1');
      healthStatus.services.database = 'healthy';
    } catch (error) {
      healthStatus.services.database = 'unhealthy';
      healthStatus.status = 'degraded';
    }

    // Check Redis connection (if implemented)
    try {
      // TODO: Add Redis health check
      healthStatus.services.redis = 'healthy';
    } catch (error) {
      healthStatus.services.redis = 'unhealthy';
      healthStatus.status = 'degraded';
    }

    // Check Docker connection
    try {
      const dockerInfo = await docker.getSystemInfo();
      healthStatus.services.docker = 'healthy';
      healthStatus.resources.docker = dockerInfo;
    } catch (error) {
      healthStatus.services.docker = 'unhealthy';
      healthStatus.status = 'degraded';
    }

    // Get system resources
    const systemInfo = getSystemInfo();
    healthStatus.resources.system = systemInfo;

    // Get sandbox statistics
    const sandboxStats = await getSandboxStats();
    healthStatus.sandboxes = sandboxStats;

    // Determine overall status
    const serviceStatuses = Object.values(healthStatus.services);
    if (serviceStatuses.every(status => status === 'healthy')) {
      healthStatus.status = 'healthy';
    } else if (serviceStatuses.some(status => status === 'unhealthy')) {
      healthStatus.status = 'unhealthy';
    }

    const statusCode = healthStatus.status === 'healthy' ? 200 :
                       healthStatus.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      success: true,
      data: healthStatus
    });

  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_ERROR',
        message: 'Failed to perform health check'
      }
    });
  }
});

// GET /api/v1/monitoring/stats - System statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = {
      sandboxes: await getSandboxStats(),
      users: await getUserStats(),
      analysis: await getAnalysisStats(),
      network: await getNetworkStats(),
      system: getSystemInfo()
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STATS_ERROR',
        message: 'Failed to get system statistics'
      }
    });
  }
});

// GET /api/v1/monitoring/metrics - Detailed metrics
router.get('/metrics', async (req, res) => {
  try {
    const { timeRange = '1h' } = req.query;

    const metrics = {
      timeRange,
      timestamp: new Date().toISOString(),
      system: getSystemMetrics(),
      sandboxes: await getSandboxMetrics(timeRange),
      database: await getDatabaseMetrics(),
      network: await getNetworkMetrics()
    };

    res.json({
      success: true,
      data: metrics
    });

  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'METRICS_ERROR',
        message: 'Failed to get system metrics'
      }
    });
  }
});

// GET /api/v1/monitoring/logs - System logs
router.get('/logs', async (req, res) => {
  try {
    const {
      level = 'info',
      service = null,
      limit = 100,
      since = null
    } = req.query;

    const logs = await getSystemLogs({
      level,
      service,
      limit: parseInt(limit),
      since
    });

    res.json({
      success: true,
      data: {
        logs,
        total: logs.length
      }
    });

  } catch (error) {
    console.error('Logs error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGS_ERROR',
        message: 'Failed to retrieve system logs'
      }
    });
  }
});

// GET /api/v1/monitoring/alerts - Active alerts
router.get('/alerts', async (req, res) => {
  try {
    const { status = 'active' } = req.query;

    const alerts = await getAlerts({
      status,
      limit: 50
    });

    res.json({
      success: true,
      data: {
        alerts,
        total: alerts.length
      }
    });

  } catch (error) {
    console.error('Alerts error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ALERTS_ERROR',
        message: 'Failed to retrieve alerts'
      }
    });
  }
});

// POST /api/v1/monitoring/alerts - Create alert
router.post('/alerts', async (req, res) => {
  try {
    const { type, severity, message, metadata = {} } = req.body;

    // Validate alert data
    if (!type || !severity || !message) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ALERT',
          message: 'Type, severity, and message are required'
        }
      });
    }

    const alert = await createAlert({
      type,
      severity,
      message,
      metadata,
      status: 'active',
      created_at: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      data: alert
    });

  } catch (error) {
    console.error('Create alert error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_ALERT_ERROR',
        message: 'Failed to create alert'
      }
    });
  }
});

// PUT /api/v1/monitoring/alerts/:id/resolve - Resolve alert
router.put('/alerts/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { resolved_by, resolution_note } = req.body;

    const alert = await resolveAlert(id, {
      resolved_by,
      resolution_note,
      resolved_at: new Date().toISOString()
    });

    res.json({
      success: true,
      data: alert
    });

  } catch (error) {
    console.error('Resolve alert error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RESOLVE_ALERT_ERROR',
        message: 'Failed to resolve alert'
      }
    });
  }
});

// GET /api/v1/monitoring/performance - Performance metrics
router.get('/performance', async (req, res) => {
  try {
    const { timeframe = '1h' } = req.query;

    const performance = {
      timeframe,
      timestamp: new Date().toISOString(),
      cpu: await getCpuMetrics(timeframe),
      memory: await getMemoryMetrics(timeframe),
      disk: await getDiskMetrics(timeframe),
      network: await getNetworkPerformanceMetrics(timeframe),
      containers: await getContainerMetrics(timeframe)
    };

    res.json({
      success: true,
      data: performance
    });

  } catch (error) {
    console.error('Performance metrics error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PERFORMANCE_ERROR',
        message: 'Failed to get performance metrics'
      }
    });
  }
});

// Helper functions

function getSystemInfo() {
  const loadAvg = os.loadavg();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    uptime: os.uptime(),
    load_average: {
      '1m': loadAvg[0],
      '5m': loadAvg[1],
      '15m': loadAvg[2]
    },
    memory: {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      usage_percent: ((usedMem / totalMem) * 100).toFixed(2)
    },
    cpu_count: os.cpus().length,
    cpu_info: os.cpus()[0]
  };
}

function getSystemMetrics() {
  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  return {
    cpu_usage: calculateCpuUsage(),
    load_average: loadAvg,
    memory_usage: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100,
    uptime: os.uptime(),
    timestamp: new Date().toISOString()
  };
}

function calculateCpuUsage() {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  cpus.forEach(cpu => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  });

  return 100 - (totalIdle / totalTick * 100);
}

async function getSandboxStats() {
  try {
    const result = await pool.query(`
      SELECT
        status,
        COUNT(*) as count
      FROM sandboxes
      GROUP BY status
    `);

    const stats = {};
    result.rows.forEach(row => {
      stats[row.status] = parseInt(row.count);
    });

    const totalResult = await pool.query('SELECT COUNT(*) as total FROM sandboxes');
    stats.total = parseInt(totalResult.rows[0].total);

    return stats;
  } catch (error) {
    console.error('Error getting sandbox stats:', error);
    return {};
  }
}

async function getUserStats() {
  try {
    const totalResult = await pool.query('SELECT COUNT(*) as total FROM users');
    const activeResult = await pool.query(`
      SELECT COUNT(*) as active
      FROM users
      WHERE last_login > NOW() - INTERVAL '24 hours'
    `);

    return {
      total: parseInt(totalResult.rows[0].total),
      active_today: parseInt(activeResult.rows[0].active)
    };
  } catch (error) {
    console.error('Error getting user stats:', error);
    return { total: 0, active_today: 0 };
  }
}

async function getAnalysisStats() {
  try {
    const totalResult = await pool.query('SELECT COUNT(*) as total FROM analysis_results');
    const successResult = await pool.query(`
      SELECT COUNT(*) as successful
      FROM analysis_results
      WHERE result_data IS NOT NULL
    `);

    return {
      total_runs: parseInt(totalResult.rows[0].total),
      successful: parseInt(successResult.rows[0].successful),
      failed: parseInt(totalResult.rows[0].total) - parseInt(successResult.rows[0].successful)
    };
  } catch (error) {
    console.error('Error getting analysis stats:', error);
    return { total_runs: 0, successful: 0, failed: 0 };
  }
}

async function getNetworkStats() {
  try {
    const captureResult = await pool.query('SELECT COUNT(*) as total FROM network_captures');
    const sizeResult = await pool.query(`
      SELECT COALESCE(SUM(file_size), 0) as total_size
      FROM network_captures
      WHERE file_size IS NOT NULL
    `);

    return {
      total_captures: parseInt(captureResult.rows[0].total),
      data_captured_gb: (parseInt(sizeResult.rows[0].total_size) / (1024 * 1024 * 1024)).toFixed(2)
    };
  } catch (error) {
    console.error('Error getting network stats:', error);
    return { total_captures: 0, data_captured_gb: 0 };
  }
}

async function getSandboxMetrics(timeRange) {
  try {
    const timeFilter = getTimeFilter(timeRange);

    const result = await pool.query(`
      SELECT
        DATE_TRUNC('hour', created_at) as hour,
        status,
        COUNT(*) as count
      FROM sandboxes
      WHERE created_at > ${timeFilter}
      GROUP BY DATE_TRUNC('hour', created_at), status
      ORDER BY hour DESC
    `);

    return result.rows;
  } catch (error) {
    console.error('Error getting sandbox metrics:', error);
    return [];
  }
}

async function getDatabaseMetrics() {
  try {
    const result = await pool.query(`
      SELECT
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_tuples,
        n_dead_tup as dead_tuples
      FROM pg_stat_user_tables
    `);

    return {
      tables: result.rows,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting database metrics:', error);
    return { tables: [], timestamp: new Date().toISOString() };
  }
}

async function getNetworkMetrics() {
  try {
    const result = await pool.query(`
      SELECT
        DATE_TRUNC('hour', created_at) as hour,
        COUNT(*) as captures
      FROM network_captures
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY DATE_TRUNC('hour', created_at)
      ORDER BY hour DESC
    `);

    return {
      captures_by_hour: result.rows,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting network metrics:', error);
    return { captures_by_hour: [], timestamp: new Date().toISOString() };
  }
}

async function getSystemLogs(options) {
  try {
    // This would typically read from a log aggregation system
    // For now, return mock data
    return [
      {
        timestamp: new Date().toISOString(),
        level: 'info',
        service: 'api',
        message: 'System operational',
        metadata: {}
      }
    ];
  } catch (error) {
    console.error('Error getting system logs:', error);
    return [];
  }
}

async function getAlerts(options) {
  try {
    // Mock alerts - in a real implementation, this would query a database
    return [
      {
        id: 'alert-1',
        type: 'system',
        severity: 'warning',
        message: 'High CPU usage detected',
        status: 'active',
        created_at: new Date().toISOString(),
        metadata: { cpu_usage: 85.5 }
      }
    ];
  } catch (error) {
    console.error('Error getting alerts:', error);
    return [];
  }
}

async function createAlert(alertData) {
  try {
    // In a real implementation, this would save to database
    return {
      id: `alert-${Date.now()}`,
      ...alertData
    };
  } catch (error) {
    console.error('Error creating alert:', error);
    throw error;
  }
}

async function resolveAlert(alertId, resolutionData) {
  try {
    // In a real implementation, this would update the database
    return {
      id: alertId,
      status: 'resolved',
      ...resolutionData
    };
  } catch (error) {
    console.error('Error resolving alert:', error);
    throw error;
  }
}

function getTimeFilter(timeRange) {
  const filters = {
    '1h': "NOW() - INTERVAL '1 hour'",
    '24h': "NOW() - INTERVAL '24 hours'",
    '7d': "NOW() - INTERVAL '7 days'",
    '30d': "NOW() - INTERVAL '30 days'"
  };
  return filters[timeRange] || filters['1h'];
}

async function getCpuMetrics(timeframe) {
  // Mock CPU metrics over time
  return {
    current: calculateCpuUsage(),
    average: 45.2,
    peak: 78.5,
    timestamps: generateTimeSeries(timeframe)
  };
}

async function getMemoryMetrics(timeframe) {
  const totalMem = os.totalmem();
  const usedMem = totalMem - os.freemem();
  const currentUsage = (usedMem / totalMem) * 100;

  return {
    current: currentUsage,
    average: 62.3,
    peak: 89.1,
    total: totalMem,
    used: usedMem,
    timestamps: generateTimeSeries(timeframe)
  };
}

async function getDiskMetrics(timeframe) {
  try {
    const stats = await fs.stat('.');
    return {
      current: 45.6,
      average: 42.1,
      peak: 67.8,
      timestamps: generateTimeSeries(timeframe)
    };
  } catch (error) {
    return {
      current: 0,
      average: 0,
      peak: 0,
      timestamps: []
    };
  }
}

async function getNetworkPerformanceMetrics(timeframe) {
  return {
    throughput: {
      inbound: 1024 * 1024 * 10, // 10 MB/s
      outbound: 1024 * 1024 * 5   // 5 MB/s
    },
    connections: 25,
    errors: 0,
    timestamps: generateTimeSeries(timeframe)
  };
}

async function getContainerMetrics(timeframe) {
  try {
    const containers = await docker.listContainers();
    return {
      total: containers.length,
      running: containers.filter(c => c.status.includes('Up')).length,
      stopped: containers.filter(c => c.status.includes('Exited')).length,
      failed: containers.filter(c => c.status.includes('Error')).length,
      timestamps: generateTimeSeries(timeframe)
    };
  } catch (error) {
    return {
      total: 0,
      running: 0,
      stopped: 0,
      failed: 0,
      timestamps: []
    };
  }
}

function generateTimeSeries(timeframe) {
  // Generate mock time series data
  const points = {
    '1h': 12,
    '24h': 24,
    '7d': 7 * 24,
    '30d': 30 * 24
  };

  const count = points[timeframe] || 12;
  const data = [];
  const now = Date.now();
  const interval = timeframe === '1h' ? 300000 : 3600000; // 5 min or 1 hour

  for (let i = count - 1; i >= 0; i--) {
    data.push({
      timestamp: new Date(now - (i * interval)).toISOString(),
      value: Math.random() * 100
    });
  }

  return data;
}

module.exports = router;