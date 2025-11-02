#!/usr/bin/env node

/**
 * Health Check Script
 * Performs comprehensive health checks for the Android Sandbox system
 */

const http = require('http');
const { Pool } = require('pg');

const API_URL = process.env.API_URL || 'http://localhost:3000';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://sandbox_admin:sandbox_password@postgres:5432/android_sandbox';

// Health check configuration
const HEALTH_CHECKS = {
  api: {
    name: 'API Server',
    timeout: 5000,
    critical: true
  },
  database: {
    name: 'Database',
    timeout: 3000,
    critical: true
  },
  docker: {
    name: 'Docker',
    timeout: 3000,
    critical: true
  },
  filesystem: {
    name: 'Filesystem',
    timeout: 2000,
    critical: false
  },
  memory: {
    name: 'Memory',
    timeout: 1000,
    critical: false
  }
};

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function log(level, message) {
  const timestamp = new Date().toISOString();
  const levelColors = {
    INFO: 'blue',
    WARN: 'yellow',
    ERROR: 'red',
    SUCCESS: 'green'
  };

  console.log(`${colorize(timestamp, 'cyan')} ${colorize(level, levelColors[level])} ${message}`);
}

function logSuccess(message) {
  log('SUCCESS', message);
}

function logInfo(message) {
  log('INFO', message);
}

function logWarn(message) {
  log('WARN', message);
}

function logError(message) {
  log('ERROR', message);
}

// HTTP request helper
function makeRequest(url, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          data: data,
          headers: res.headers
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(timeout, () => {
      req.abort();
      reject(new Error('Request timeout'));
    });
  });
}

// API health check
async function checkApiHealth() {
  try {
    const startTime = Date.now();
    const response = await makeRequest(`${API_URL}/api/v1/health`, HEALTH_CHECKS.api.timeout);
    const responseTime = Date.now() - startTime;

    if (response.statusCode === 200) {
      try {
        const healthData = JSON.parse(response.data);
        return {
          status: 'healthy',
          responseTime,
          details: healthData.data
        };
      } catch (parseError) {
        return {
          status: 'degraded',
          responseTime,
          error: 'Invalid response format'
        };
      }
    } else {
      return {
        status: 'unhealthy',
        responseTime,
        error: `HTTP ${response.statusCode}`
      };
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}

// Database health check
async function checkDatabaseHealth() {
  let pool;
  try {
    pool = new Pool({
      connectionString: DATABASE_URL,
      connectionTimeoutMillis: HEALTH_CHECKS.database.timeout
    });

    const startTime = Date.now();
    const result = await pool.query('SELECT 1 as health_check');
    const responseTime = Date.now() - startTime;

    return {
      status: 'healthy',
      responseTime,
      details: {
        connected: true,
        query_result: result.rows[0]
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Docker health check
async function checkDockerHealth() {
  try {
    const { exec } = require('child_process');
    const startTime = Date.now();

    const dockerCheck = () => new Promise((resolve, reject) => {
      exec('docker version --format "{{.Server.Version}}"', { timeout: HEALTH_CHECKS.docker.timeout }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout.trim());
        }
      });
    });

    const version = await dockerCheck();
    const responseTime = Date.now() - startTime;

    return {
      status: 'healthy',
      responseTime,
      details: {
        version,
        connected: true
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}

// Filesystem health check
async function checkFilesystemHealth() {
  try {
    const fs = require('fs');
    const path = require('path');
    const startTime = Date.now();

    // Check if critical directories exist and are writable
    const criticalDirs = ['/tmp', '/opt', process.cwd()];
    const checks = [];

    for (const dir of criticalDirs) {
      try {
        const stats = fs.statSync(dir);
        const testFile = path.join(dir, '.health-check-test');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        checks.push({ path: dir, status: 'ok' });
      } catch (error) {
        checks.push({ path: dir, status: 'error', error: error.message });
      }
    }

    const responseTime = Date.now() - startTime;
    const hasErrors = checks.some(check => check.status === 'error');

    return {
      status: hasErrors ? 'degraded' : 'healthy',
      responseTime,
      details: { checks }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}

// Memory health check
async function checkMemoryHealth() {
  try {
    const startTime = Date.now();
    const os = require('os');
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsagePercent = (usedMem / totalMem) * 100;

    const responseTime = Date.now() - startTime;
    let status = 'healthy';

    if (memoryUsagePercent > 90) {
      status = 'unhealthy';
    } else if (memoryUsagePercent > 80) {
      status = 'degraded';
    }

    return {
      status,
      responseTime,
      details: {
        total: Math.round(totalMem / 1024 / 1024), // MB
        used: Math.round(usedMem / 1024 / 1024),   // MB
        free: Math.round(freeMem / 1024 / 1024),   // MB
        usage_percent: Math.round(memoryUsagePercent * 100) / 100
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}

// Main health check function
async function performHealthChecks() {
  logInfo('Starting comprehensive health checks...');

  const results = {};
  let overallStatus = 'healthy';
  let hasCriticalFailures = false;

  // Perform all health checks
  const checks = {
    api: checkApiHealth,
    database: checkDatabaseHealth,
    docker: checkDockerHealth,
    filesystem: checkFilesystemHealth,
    memory: checkMemoryHealth
  };

  for (const [name, checkFunction] of Object.entries(checks)) {
    const config = HEALTH_CHECKS[name];
    logInfo(`Checking ${config.name}...`);

    try {
      const result = await checkFunction();
      results[name] = {
        ...config,
        ...result,
        timestamp: new Date().toISOString()
      };

      if (result.status === 'unhealthy' && config.critical) {
        hasCriticalFailures = true;
        overallStatus = 'unhealthy';
      } else if (result.status === 'degraded' && overallStatus === 'healthy') {
        overallStatus = 'degraded';
      }

      const statusColor = result.status === 'healthy' ? 'green' :
                          result.status === 'degraded' ? 'yellow' : 'red';

      logInfo(`${config.name}: ${colorize(result.status.toUpperCase(), statusColor)}`);

      if (result.responseTime) {
        logInfo(`  Response time: ${result.responseTime}ms`);
      }

      if (result.error) {
        logError(`  Error: ${result.error}`);
      }

    } catch (error) {
      results[name] = {
        ...config,
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };

      if (config.critical) {
        hasCriticalFailures = true;
      }
      overallStatus = 'unhealthy';

      logError(`${config.name}: ${colorize('UNHEALTHY', 'red')} - ${error.message}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  logInfo('Health Check Summary');
  console.log('='.repeat(60));

  const overallStatusColor = overallStatus === 'healthy' ? 'green' :
                            overallStatus === 'degraded' ? 'yellow' : 'red';

  logInfo(`Overall Status: ${colorize(overallStatus.toUpperCase(), overallStatusColor)}`);

  // Detailed results
  for (const [name, result] of Object.entries(results)) {
    const statusColor = result.status === 'healthy' ? 'green' :
                        result.status === 'degraded' ? 'yellow' : 'red';

    console.log(`\n${colorize(result.name, 'cyan')}:`);
    console.log(`  Status: ${colorize(result.status.toUpperCase(), statusColor)}`);
    console.log(`  Timestamp: ${result.timestamp}`);

    if (result.responseTime) {
      console.log(`  Response Time: ${result.responseTime}ms`);
    }

    if (result.details) {
      console.log(`  Details: ${JSON.stringify(result.details, null, 2)}`);
    }

    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
  }

  // Exit with appropriate code
  const exitCode = hasCriticalFailures ? 1 : 0;
  console.log('\n' + '='.repeat(60));
  logInfo(`Health check completed with exit code: ${exitCode}`);
  console.log('='.repeat(60));

  process.exit(exitCode);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logInfo('Health check interrupted by user');
  process.exit(130);
});

process.on('SIGTERM', () => {
  logInfo('Health check terminated');
  process.exit(143);
});

// Run health checks
if (require.main === module) {
  performHealthChecks().catch(error => {
    logError(`Health check failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  performHealthChecks,
  checkApiHealth,
  checkDatabaseHealth,
  checkDockerHealth,
  checkFilesystemHealth,
  checkMemoryHealth
};