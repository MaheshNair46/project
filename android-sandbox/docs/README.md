# Android Virtual Sandbox

A comprehensive Android virtualization platform designed for security research, malware analysis, and application testing. The system provides complete Android OS virtualization with configurable network settings, system-level access, and integrated analysis tools.

## 🚀 Features

### Core Capabilities
- **Full Android OS Virtualization**: Complete Android environment in Docker containers
- **Configurable Network Settings**: Custom IP ranges, DNS, proxy, routing, and traffic simulation
- **System-Level Configuration**: Full access to Android settings and system properties
- **Multi-Instance Support**: Run 5-10 concurrent sandbox instances
- **Web-Based Management**: Intuitive React dashboard with Node.js backend
- **RESTful API**: Complete API for automation and integration

### Security & Analysis Tools
- **Frida Integration**: Dynamic instrumentation and runtime manipulation
- **Network Traffic Capture**: tcpdump integration with custom filters
- **System Call Tracing**: strace for comprehensive system monitoring
- **SSL/TLS Unpinning**: Bypass certificate validation for analysis
- **Crypto Function Hooking**: Monitor cryptographic operations

### Network Features
- **Custom Bridge Networks**: Isolated network namespaces per instance
- **Traffic Simulation**: Latency, packet loss, bandwidth limiting
- **Packet Capture**: Advanced filtering and analysis capabilities
- **Proxy Support**: HTTP/HTTPS proxy configuration
- **DNS Configuration**: Custom DNS servers and resolution

### Security Features
- **Role-Based Access Control**: Admin, Analyst, Viewer roles
- **Permission System**: Granular permissions for all operations
- **Audit Logging**: Complete activity tracking and monitoring
- **Session Management**: Secure JWT-based authentication
- **Resource Isolation**: Complete separation between instances

## 📋 System Requirements

### Minimum Requirements
- **Operating System**: Linux (Ubuntu 20.04+, CentOS 8+, RHEL 8+)
- **RAM**: 16GB for 5 concurrent instances (4GB per instance minimum)
- **Storage**: 100GB+ free space (20GB per instance)
- **CPU**: 8+ cores with hardware virtualization support

### Software Prerequisites
- **Docker**: 20.10+ with Docker Compose 2.0+
- **Hardware Virtualization**: KVM enabled for optimal performance
- **Network**: Root privileges for network configuration
- **Git**: For cloning and managing the repository

### Recommended Configuration
- **RAM**: 32GB+ for 10 concurrent instances
- **Storage**: 200GB+ SSD storage
- **CPU**: 16+ cores with VT-x/AMD-V support
- **Network**: Gigabit Ethernet for optimal performance

## 🛠️ Installation

### 1. System Preparation

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Docker and Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Enable KVM for hardware virtualization
sudo modprobe kvm
sudo chown $USER /dev/kvm

# Verify installation
docker --version
docker-compose --version
```

### 2. Clone Repository

```bash
# Clone the repository
git clone <repository-url>
cd android-sandbox

# Verify directory structure
ls -la
```

### 3. Configuration

```bash
# Copy environment configuration
cp .env.example .env

# Edit configuration file
nano .env
```

**Environment Configuration (.env):**
```bash
# Security
JWT_SECRET=your-super-secret-jwt-key-change-in-production
SESSION_SECRET=your-session-secret-change-in-production

# Database
DATABASE_URL=postgresql://sandbox_admin:sandbox_password@postgres:5432/android_sandbox
REDIS_URL=redis://redis:6379

# API Configuration
API_BASE_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3001

# Docker Configuration
DOCKER_HOST=unix:///var/run/docker.sock

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Performance
MAX_CONCURRENT_SANDBOXES=10
SANDBOX_TIMEOUT=300
```

### 4. Initialize System

```bash
# Create management networks
./network/setup-networks.sh init

# Build base images
docker build -t android-sandbox:base .

# Pull required dependencies
docker pull frida/frida:latest
docker pull alpine:latest

# Start services
docker-compose up -d

# Verify installation
curl http://localhost:3000/api/v1/health
```

### 5. Create First User

```bash
# Create admin user (default password: admin123)
docker-compose exec api node scripts/create-admin.js

# Or register via API
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@example.com",
    "password": "secure_password",
    "role": "admin"
  }'
```

## 🚀 Quick Start

### 1. Access Web Dashboard

Open your browser and navigate to `http://localhost:3001`

- **Default Login**: admin / admin123
- **Change Password**: Immediately change the default password

### 2. Create Your First Sandbox

Using the Web Interface:
1. Navigate to "Sandboxes" → "Create Sandbox"
2. Configure basic settings (name, Android version, device profile)
3. Choose network configuration
4. Select analysis tools and security policy
5. Review and create

Using Command Line:
```bash
# Create a basic sandbox
./scripts/create-sandbox.sh --name "test-sandbox" --android-version 12

# Create with custom configuration
./scripts/create-sandbox.sh \
  --name "malware-analysis" \
  --android-version 12 \
  --device-profile "pixel-5" \
  --security-policy "analysis-mode" \
  --tools "frida,tcpdump,strace" \
  --ip-address "192.168.100.10" \
  --auto-start
```

### 3. Connect to Your Sandbox

```bash
# Connect via ADB
adb connect localhost:<adb_port>

# View via VNC
vnc://localhost:<vnc_port>

# List all sandboxes
./scripts/list-sandboxes.sh --detailed

# Start/stop sandboxes
./scripts/control-sandbox.sh start <sandbox_id>
./scripts/control-sandbox.sh stop <sandbox_id>
```

## 📖 Usage Guide

### Web Dashboard

The web dashboard provides an intuitive interface for managing sandboxes:

1. **Dashboard**: Overview of system status and statistics
2. **Sandboxes**: Create, manage, and monitor sandbox instances
3. **Network**: Configure network settings and capture traffic
4. **Analysis**: View analysis results and manage tools
5. **Monitoring**: System monitoring and health checks
6. **Settings**: User management and system configuration

### Command Line Tools

#### Sandbox Management

```bash
# Create sandbox
./scripts/create-sandbox.sh [options]

# List sandboxes
./scripts/list-sandboxes.sh [options]

# Delete sandbox
./scripts/delete-sandbox.sh <sandbox_id>

# Control sandbox
./scripts/control-sandbox.sh <action> <sandbox_id>
```

#### Network Management

```bash
# Setup networks
./network/setup-networks.sh <command> [options]

# Simulate network conditions
./network/simulate-conditions.sh <command> [options]

# Capture traffic
./network/capture-traffic.sh <command> [options]
```

### API Usage

The REST API provides complete programmatic access:

```bash
# Authentication
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}' | \
  jq -r '.data.token')

# Create sandbox
curl -X POST http://localhost:3000/api/v1/sandboxes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "api-sandbox",
    "android_version": "12",
    "device_profile": "pixel-5",
    "analysis_tools": ["frida", "tcpdump"]
  }'

# List sandboxes
curl -X GET http://localhost:3000/api/v1/sandboxes \
  -H "Authorization: Bearer $TOKEN"
```

## 🔧 Configuration

### Device Profiles

Device profiles define the hardware and software characteristics of your sandboxes:

```yaml
# config/device-templates/pixel-5.yml
name: "Pixel 5"
android:
  version: "12"
  api_level: 31
hardware:
  ram_mb: 4096
  storage_gb: 128
  screen:
    resolution: "1080x2340"
    density: 440
```

### Network Profiles

Network profiles define network configuration and isolation:

```yaml
# config/network-profiles/standard.yml
name: "Standard Network"
type: "custom_bridge"
ip:
  range: "192.168.100.0/24"
  gateway: "192.168.100.1"
  dns_servers: ["8.8.8.8", "8.8.4.4"]
```

### Security Policies

Security policies define security settings and analysis tool configurations:

```yaml
# config/security-policies/analysis-mode.yml
name: "Analysis Mode"
device:
  selinux: "permissive"
  root_access: true
analysis:
  tools: ["frida", "tcpdump", "strace"]
  auto_start: true
```

## 🔒 Security

### Authentication & Authorization

- **JWT-based Authentication**: Secure token-based authentication
- **Role-Based Access Control**: Admin, Analyst, Viewer roles
- **Permission System**: Granular permissions for all operations
- **Session Management**: Secure session handling with timeout

### Isolation & Security

- **Container Isolation**: Each sandbox in separate Docker container
- **Network Isolation**: Dedicated network namespaces per instance
- **File System Isolation**: Separate storage volumes per sandbox
- **Process Isolation**: No shared processes between instances

### Audit & Monitoring

- **Audit Logging**: Complete activity tracking with timestamps
- **Resource Monitoring**: CPU, RAM, storage usage per instance
- **Network Monitoring**: Connection tracking and bandwidth usage
- **Access Control**: Secure access to management interfaces

## 🐛 Troubleshooting

### Common Issues

1. **Docker Permission Denied**
   ```bash
   sudo usermod -aG docker $USER
   newgrp docker
   ```

2. **KVM Not Available**
   ```bash
   sudo modprobe kvm
   sudo chown $USER /dev/kvm
   # Enable virtualization in BIOS if needed
   ```

3. **Port Conflicts**
   ```bash
   # Check port usage
   netstat -tulpn | grep :3000
   # Stop conflicting services
   sudo systemctl stop nginx  # or other conflicting service
   ```

4. **Memory Issues**
   ```bash
   # Check available memory
   free -h
   # Reduce concurrent sandboxes in .env
   MAX_CONCURRENT_SANDBOXES=3
   ```

5. **Network Issues**
   ```bash
   # Check Docker networks
   docker network ls
   # Reset networks
   ./network/setup-networks.sh cleanup
   ./network/setup-networks.sh init
   ```

### Debug Mode

Enable debug logging:

```bash
# Set log level
export LOG_LEVEL=debug

# Restart services
docker-compose restart

# View logs
docker-compose logs -f api
docker-compose logs -f dashboard
```

### Health Checks

```bash
# Check API health
curl http://localhost:3000/api/v1/health

# Check individual services
docker-compose ps

# Check system resources
docker stats
```

## 📚 API Reference

### Authentication Endpoints

```
POST /api/v1/auth/login
POST /api/v1/auth/register
POST /api/v1/auth/logout
POST /api/v1/auth/refresh
GET  /api/v1/auth/me
```

### Sandbox Endpoints

```
GET    /api/v1/sandboxes
POST   /api/v1/sandboxes
GET    /api/v1/sandboxes/:id
PUT    /api/v1/sandboxes/:id
DELETE /api/v1/sandboxes/:id
POST   /api/v1/sandboxes/:id/start
POST   /api/v1/sandboxes/:id/stop
GET    /api/v1/sandboxes/:id/logs
```

### Network Endpoints

```
GET  /api/v1/network/config
PUT  /api/v1/network/config
POST /api/v1/network/simulate
POST /api/v1/network/capture
GET  /api/v1/network/status
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs/](./docs/)
- **Issues**: [GitHub Issues](https://github.com/your-org/android-sandbox/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/android-sandbox/discussions)
- **Email**: support@android-sandbox.local

## 🙏 Acknowledgments

- Android Emulator project
- Docker containerization platform
- Frida dynamic instrumentation framework
- React and Node.js communities
- All contributors and users

---

**Android Virtual Sandbox** - Complete Android virtualization for security research and analysis.