# API Reference

The Android Virtual Sandbox provides a comprehensive RESTful API for managing sandboxes, network configuration, and analysis tools.

## 🌐 Base URL

```
Development: http://localhost:3000/api/v1
Production:  https://your-domain.com/api/v1
```

## 🔐 Authentication

All API endpoints (except authentication endpoints) require JWT authentication.

### Headers

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Authentication Flow

1. **Login** to obtain JWT token
2. **Include token** in `Authorization` header
3. **Refresh token** before expiration
4. **Logout** to invalidate token

## 📝 Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {} // Optional additional details
  }
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `429` - Too Many Requests
- `500` - Internal Server Error

## 🔑 Authentication Endpoints

### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "username": "string (3-30 chars, alphanumeric)",
  "email": "string (valid email)",
  "password": "string (min 8 chars)",
  "role": "admin|analyst|viewer (optional, default: analyst)",
  "permissions": ["string"] (optional)
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "string",
      "email": "string",
      "role": "string",
      "permissions": ["string"],
      "created_at": "iso8601"
    },
    "token": "jwt_token",
    "expiresIn": "24h"
  }
}
```

### POST /auth/login
Authenticate user and obtain JWT token.

**Request Body:**
```json
{
  "username": "string",
  "password": "string",
  "remember": "boolean (optional, default: false)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "string",
      "email": "string",
      "role": "string",
      "permissions": ["string"],
      "last_login": "iso8601"
    },
    "token": "jwt_token",
    "expiresIn": "24h"
  }
}
```

### POST /auth/refresh
Refresh access token.

**Request Body:**
```json
{
  "refreshToken": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "new_jwt_token",
    "expiresIn": "24h"
  }
}
```

### POST /auth/logout
Invalidate current session.

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

### GET /auth/me
Get current user information.

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "string",
      "email": "string",
      "role": "string",
      "permissions": ["string"],
      "last_login": "iso8601",
      "created_at": "iso8601"
    }
  }
}
```

### PUT /auth/change-password
Change user password.

**Request Body:**
```json
{
  "currentPassword": "string",
  "newPassword": "string (min 8 chars)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Password changed successfully"
  }
}
```

### GET /auth/permissions
Get all available permissions.

**Response:**
```json
{
  "success": true,
  "data": {
    "Sandbox Management": [
      {
        "name": "sandbox:read",
        "description": "Read sandbox information"
      }
    ]
  }
}
```

### GET /auth/roles
Get all available roles with permissions.

**Response:**
```json
{
  "success": true,
  "data": {
    "admin": {
      "permissions": ["sandbox:read", "sandbox:create"],
      "permissionDetails": [
        {
          "name": "sandbox:read",
          "description": "Read sandbox information",
          "category": "Sandbox Management"
        }
      ]
    }
  }
}
```

## 📱 Sandbox Endpoints

### GET /sandboxes
List all sandboxes with optional filtering.

**Query Parameters:**
- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Items per page (default: 20)
- `status` (string, optional): Filter by status (running, stopped, failed, starting)
- `search` (string, optional): Search by name or tags

**Response:**
```json
{
  "success": true,
  "data": {
    "sandboxes": [
      {
        "id": "uuid",
        "name": "string",
        "user_id": "uuid",
        "android_version": "string",
        "device_profile": "string",
        "network_config": {},
        "analysis_tools": ["string"],
        "security_policy": "string",
        "status": "running|stopped|failed|starting",
        "container_id": "string",
        "adb_port": "integer",
        "vnc_port": "integer",
        "ip_address": "string",
        "tags": ["string"],
        "created_at": "iso8601",
        "updated_at": "iso8601",
        "started_at": "iso8601",
        "stopped_at": "iso8601"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "pages": 5
    }
  }
}
```

### POST /sandboxes
Create a new sandbox.

**Request Body:**
```json
{
  "name": "string (3-50 chars)",
  "android_version": "11|12|13",
  "device_profile": "string",
  "network_config": {
    "ip_address": "string (optional)",
    "dns_servers": ["string"] (optional),
    "proxy": "string (optional)",
    "bandwidth_kbps": "integer (optional)",
    "latency_ms": "integer (optional)",
    "packet_loss_percent": "number (optional)"
  },
  "analysis_tools": ["frida|tcpdump|strace|logcat"],
  "security_policy": "analysis-mode|stealth-mode",
  "auto_start": "boolean (optional, default: false)",
  "tags": ["string"] (optional)
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "string",
    "status": "starting",
    "adb_port": 5555,
    "vnc_port": 5900,
    "created_at": "iso8601"
  }
}
```

### GET /sandboxes/:id
Get specific sandbox details.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "string",
    "user_id": "uuid",
    "android_version": "string",
    "device_profile": "string",
    "network_config": {},
    "analysis_tools": ["string"],
    "security_policy": "string",
    "status": "running",
    "container_id": "string",
    "adb_port": 5555,
    "vnc_port": 5900,
    "ip_address": "192.168.100.10",
    "container_info": {},
    "network_info": {},
    "created_at": "iso8601",
    "updated_at": "iso8601"
  }
}
```

### PUT /sandboxes/:id
Update sandbox configuration.

**Request Body:**
```json
{
  "name": "string (optional)",
  "network_config": {} (optional),
  "analysis_tools": ["string"] (optional),
  "tags": ["string"] (optional)
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "string",
    "updated_at": "iso8601"
  }
}
```

### DELETE /sandboxes/:id
Delete a sandbox.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "message": "Sandbox deleted successfully"
  }
}
```

### POST /sandboxes/:id/start
Start a sandbox.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "running",
    "adb_port": 5555,
    "vnc_port": 5900,
    "ip_address": "192.168.100.10"
  }
}
```

### POST /sandboxes/:id/stop
Stop a sandbox.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "stopped"
  }
}
```

### POST /sandboxes/:id/restart
Restart a sandbox.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "running",
    "adb_port": 5555,
    "vnc_port": 5900,
    "ip_address": "192.168.100.10"
  }
}
```

### GET /sandboxes/:id/logs
Get sandbox logs.

**Query Parameters:**
- `lines` (integer, optional): Number of lines to retrieve (default: 100)
- `follow` (boolean, optional): Stream logs (default: false)

**Response (stream):**
```
2023-10-01 10:00:00 INFO  Starting Android emulator...
2023-10-01 10:00:05 INFO  Android emulator started successfully
```

## 🌐 Network Endpoints

### GET /network/config
Get network configuration.

**Response:**
```json
{
  "success": true,
  "data": {
    "interfaces": [
      {
        "name": "eth0",
        "ip_address": "192.168.100.1",
        "gateway": "192.168.100.1",
        "status": "up"
      }
    ],
    "dns_servers": ["8.8.8.8", "8.8.4.4"],
    "proxy": {
      "enabled": false,
      "http_proxy": "",
      "https_proxy": ""
    }
  }
}
```

### PUT /network/config
Update network configuration.

**Request Body:**
```json
{
  "dns_servers": ["8.8.8.8", "1.1.1.1"],
  "proxy": {
    "enabled": true,
    "http_proxy": "http://proxy.example.com:8080",
    "https_proxy": "http://proxy.example.com:8080"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Network configuration updated"
  }
}
```

### POST /network/simulate
Apply network conditions.

**Request Body:**
```json
{
  "sandbox_id": "uuid",
  "conditions": {
    "latency_ms": 100,
    "packet_loss_percent": 5,
    "bandwidth_kbps": 1000
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Network conditions applied"
  }
}
```

### POST /network/capture
Start network packet capture.

**Request Body:**
```json
{
  "sandbox_id": "uuid",
  "interface": "eth0",
  "filter": "tcp port 80",
  "duration_seconds": 300
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "capture_id": "uuid",
    "file_path": "/opt/captures/sandbox-12345-cap.pcap"
  }
}
```

### GET /network/captures/:id/status
Get capture status.

**Response:**
```json
{
  "success": true,
  "data": {
    "capture_id": "uuid",
    "status": "running|stopped|completed",
    "file_size": 1048576,
    "duration_seconds": 300,
    "packets_captured": 1500
  }
}
```

### DELETE /network/captures/:id
Stop and delete capture.

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Capture deleted successfully"
  }
}
```

## 🔬 Analysis Endpoints

### GET /analysis/results
Get analysis results.

**Query Parameters:**
- `sandbox_id` (string, optional): Filter by sandbox
- `tool` (string, optional): Filter by analysis tool
- `limit` (integer, optional): Results limit (default: 50)

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "uuid",
        "sandbox_id": "uuid",
        "tool": "frida",
        "result_type": "ssl_unpinning",
        "result_data": {},
        "created_at": "iso8601"
      }
    ]
  }
}
```

### POST /analysis/run
Run analysis tool on sandbox.

**Request Body:**
```json
{
  "sandbox_id": "uuid",
  "tool": "frida",
  "script": "ssl-unpinning.js",
  "target": "com.example.app",
  "options": {}
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "analysis_id": "uuid",
    "status": "running",
    "started_at": "iso8601"
  }
}
```

### GET /analysis/:id
Get specific analysis result.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "sandbox_id": "uuid",
    "tool": "frida",
    "result_type": "ssl_unpinning",
    "result_data": {
      "ssl_connections": 5,
      "certificates_bypassed": 3,
      "domains": ["example.com", "api.example.com"]
    },
    "created_at": "iso8601"
  }
}
```

### GET /analysis/tools
Get available analysis tools.

**Response:**
```json
{
  "success": true,
  "data": {
    "tools": [
      {
        "name": "frida",
        "description": "Dynamic instrumentation framework",
        "scripts": ["ssl-unpinning.js", "network-monitoring.js", "crypto-hooks.js"]
      },
      {
        "name": "tcpdump",
        "description": "Network packet capture",
        "filters": ["http-https.txt", "malware-c2.txt"]
      }
    ]
  }
}
```

## ⚙️ Configuration Endpoints

### GET /config/device-templates
Get available device templates.

**Response:**
```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "name": "Pixel 5",
        "file": "pixel-5.yml",
        "android_version": "12",
        "ram_mb": 4096,
        "storage_gb": 128
      }
    ]
  }
}
```

### GET /config/device-templates/:name
Get specific device template.

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "Pixel 5",
    "android": {
      "version": "12",
      "api_level": 31
    },
    "hardware": {
      "ram_mb": 4096,
      "storage_gb": 128,
      "screen": {
        "resolution": "1080x2340",
        "density": 440
      }
    }
  }
}
```

### GET /config/network-profiles
Get available network profiles.

**Response:**
```json
{
  "success": true,
  "data": {
    "profiles": [
      {
        "name": "Standard Network",
        "file": "standard.yml",
        "type": "custom_bridge",
        "ip_range": "192.168.100.0/24"
      }
    ]
  }
}
```

### GET /config/security-policies
Get available security policies.

**Response:**
```json
{
  "success": true,
  "data": {
    "policies": [
      {
        "name": "Analysis Mode",
        "file": "analysis-mode.yml",
        "description": "Permissive security for analysis"
      }
    ]
  }
}
```

## 📊 Monitoring Endpoints

### GET /monitoring/health
Get system health status.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "services": {
      "api": "healthy",
      "database": "healthy",
      "redis": "healthy",
      "docker": "healthy"
    },
    "resources": {
      "cpu_usage": 45.2,
      "memory_usage": 68.5,
      "disk_usage": 32.1
    },
    "sandboxes": {
      "total": 10,
      "running": 3,
      "stopped": 5,
      "failed": 2
    }
  }
}
```

### GET /monitoring/stats
Get system statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "sandboxes": {
      "total": 100,
      "running": 25,
      "stopped": 70,
      "failed": 5
    },
    "users": {
      "total": 15,
      "active_today": 8
    },
    "analysis": {
      "total_runs": 1500,
      "successful": 1420,
      "failed": 80
    },
    "network": {
      "total_captures": 200,
      "data_captured_gb": 15.6
    }
  }
}
```

### GET /monitoring/logs
Get system logs.

**Query Parameters:**
- `level` (string, optional): Log level (error, warn, info, debug)
- `service` (string, optional): Service name
- `limit` (integer, optional): Log limit (default: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "timestamp": "iso8601",
        "level": "info",
        "service": "api",
        "message": "Sandbox created successfully",
        "metadata": {}
      }
    ]
  }
}
```

## 🔧 System Endpoints

### GET /system/info
Get system information.

**Response:**
```json
{
  "success": true,
  "data": {
    "version": "1.0.0",
    "build": "20231001-1200",
    "uptime": 86400,
    "environment": "production",
    "docker": {
      "version": "24.0.0",
      "api_version": "1.43"
    },
    "resources": {
      "cpu_cores": 16,
      "memory_gb": 32,
      "disk_gb": 500
    }
  }
}
```

### POST /system/backup
Create system backup.

**Request Body:**
```json
{
  "type": "full|config|database",
  "description": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "backup_id": "uuid",
    "file_path": "/opt/backups/backup_20231001_120000.tar.gz",
    "size_bytes": 1073741824,
    "created_at": "iso8601"
  }
}
```

## 🚨 Error Codes

| Code | Description |
|------|-------------|
| `INVALID_CREDENTIALS` | Invalid username or password |
| `TOKEN_EXPIRED` | JWT token has expired |
| `INSUFFICIENT_PERMISSIONS` | User lacks required permissions |
| `SANDBOX_LIMIT_REACHED` | Maximum sandbox limit reached |
| `SANDBOX_NOT_FOUND` | Sandbox not found |
| `ALREADY_RUNNING` | Sandbox is already running |
| `DOCKER_ERROR` | Docker operation failed |
| `NETWORK_ERROR` | Network configuration failed |
| `VALIDATION_ERROR` | Request validation failed |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INTERNAL_ERROR` | Internal server error |

## 📝 Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

class SandboxAPI {
  constructor(baseURL, token) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async login(username, password) {
    const response = await this.client.post('/auth/login', {
      username,
      password
    });
    return response.data;
  }

  async createSandbox(config) {
    const response = await this.client.post('/sandboxes', config);
    return response.data;
  }

  async listSandboxes(filters = {}) {
    const response = await this.client.get('/sandboxes', { params: filters });
    return response.data;
  }

  async startSandbox(id) {
    const response = await this.client.post(`/sandboxes/${id}/start`);
    return response.data;
  }
}

// Usage
const api = new SandboxAPI('http://localhost:3000/api/v1');

async function example() {
  // Login
  const auth = await api.login('admin', 'password');
  const token = auth.data.token;

  // Create API client with token
  const client = new SandboxAPI('http://localhost:3000/api/v1', token);

  // Create sandbox
  const sandbox = await client.createSandbox({
    name: 'test-sandbox',
    android_version: '12',
    device_profile: 'pixel-5',
    analysis_tools: ['frida', 'tcpdump']
  });

  console.log('Created sandbox:', sandbox.data.id);
}
```

### Python

```python
import requests
import json

class SandboxAPI:
    def __init__(self, base_url, token=None):
        self.base_url = base_url
        self.token = token
        self.session = requests.Session()

        if token:
            self.session.headers.update({
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json'
            })

    def login(self, username, password):
        response = self.session.post(f'{self.base_url}/auth/login', json={
            'username': username,
            'password': password
        })
        response.raise_for_status()
        data = response.json()
        self.token = data['data']['token']
        self.session.headers.update({
            'Authorization': f'Bearer {self.token}'
        })
        return data

    def create_sandbox(self, config):
        response = self.session.post(f'{self.base_url}/sandboxes', json=config)
        response.raise_for_status()
        return response.json()

    def list_sandboxes(self, filters=None):
        params = filters or {}
        response = self.session.get(f'{self.base_url}/sandboxes', params=params)
        response.raise_for_status()
        return response.json()

    def start_sandbox(self, sandbox_id):
        response = self.session.post(f'{self.base_url}/sandboxes/{sandbox_id}/start')
        response.raise_for_status()
        return response.json()

# Usage
api = SandboxAPI('http://localhost:3000/api/v1')

# Login
auth = api.login('admin', 'password')

# Create sandbox
sandbox = api.create_sandbox({
    'name': 'test-sandbox',
    'android_version': '12',
    'device_profile': 'pixel-5',
    'analysis_tools': ['frida', 'tcpdump']
})

print(f"Created sandbox: {sandbox['data']['id']}")
```

### cURL

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}' | \
  jq -r '.data.token')

# Create sandbox
SANDBOX=$(curl -s -X POST http://localhost:3000/api/v1/sandboxes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-sandbox",
    "android_version": "12",
    "device_profile": "pixel-5",
    "analysis_tools": ["frida", "tcpdump"]
  }')

SANDBOX_ID=$(echo $SANDBOX | jq -r '.data.id')

echo "Created sandbox: $SANDBOX_ID"

# List sandboxes
curl -s -X GET http://localhost:3000/api/v1/sandboxes \
  -H "Authorization: Bearer $TOKEN" | \
  jq '.data.sandboxes[] | {name: .name, status: .status}'

# Start sandbox
curl -s -X POST http://localhost:3000/api/v1/sandboxes/$SANDBOX_ID/start \
  -H "Authorization: Bearer $TOKEN" | \
  jq '.data.status'
```

---

For additional information and examples, refer to the main [README.md](./README.md) and [Deployment Guide](./DEPLOYMENT.md).