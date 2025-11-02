const Docker = require('dockerode');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;
const yaml = require('yaml');
const logger = require('../utils/logger');

class DockerService {
  constructor() {
    this.docker = new Docker();
    this.configDir = path.join(__dirname, '../../config');
  }

  async buildContainerConfig(sandboxData) {
    try {
      // Load device template
      const deviceTemplate = await this.loadDeviceTemplate(sandboxData.device_profile);

      // Load network profile
      const networkProfile = await this.loadNetworkProfile('standard');

      // Load security policy
      const securityPolicy = await this.loadSecurityPolicy(sandboxData.security_policy);

      // Build container configuration
      const config = {
        Image: 'android-sandbox:base',
        name: `android-sandbox-${sandboxData.id}`,
        Env: [
          `SANDBOX_ID=${sandboxData.id}`,
          `SANDBOX_NAME=${sandboxData.name}`,
          `ANDROID_VERSION=${sandboxData.android_version}`,
          `DEVICE_PROFILE=${sandboxData.device_profile}`,
          `ANALYSIS_TOOLS=${sandboxData.analysis_tools.join(',')}`,
          `SECURITY_POLICY=${sandboxData.security_policy}`,
          'ADB_PUBLIC_KEY=1'  # Enable ADB by default
        ],
        HostConfig: {
          PortBindings: {
            '5555/tcp': [{ HostPort: '0' }],  # ADB - random port
            '5900/tcp': [{ HostPort: '0' }]   # VNC - random port
          },
          Binds: [
            `${this.configDir}:/app/config:ro`,
            '/opt/captures:/opt/captures',
            '/opt/logs:/opt/logs'
          ],
          Privileged: true,
          CapAdd: ['SYS_ADMIN', 'NET_ADMIN'],
          Devices: [
            '/dev/kvm:/dev/kvm'
          ],
          ShmSize: 1073741824,  # 1GB
          Memory: sandboxData.ram_mb ? sandboxData.ram_mb * 1024 * 1024 : 4294967296,  # Default 4GB
          CpuQuota: sandboxData.cpu_limit ? sandboxData.cpu_limit * 100 : 50000,  # Default 50% CPU
          RestartPolicy: {
            Name: 'unless-stopped'
          }
        },
        NetworkingConfig: {
          EndpointsConfig: {
            'android-sandbox-mgmt': {
              IPAMConfig: {}
            }
          }
        }
      };

      // Add custom network if specified
      if (sandboxData.network_config && sandboxData.network_config.ip_address) {
        const customNetwork = `android-sandbox-instance-${sandboxData.id}`;
        await this.createCustomNetwork(customNetwork, sandboxData.network_config);

        config.NetworkingConfig.EndpointsConfig[customNetwork] = {
          IPAMConfig: {
            IPv4Address: sandboxData.network_config.ip_address
          }
        };
      }

      // Add device-specific environment variables
      if (deviceTemplate.properties) {
        Object.entries(deviceTemplate.properties).forEach(([key, value]) => {
          config.Env.push(`${key}=${value}`);
        });
      }

      return config;

    } catch (error) {
      logger.error('Error building container config:', error);
      throw error;
    }
  }

  async createContainer(sandboxId, config) {
    try {
      const container = await this.docker.createContainer(config);
      logger.info(`Container created: ${container.id} for sandbox: ${sandboxId}`);
      return container;
    } catch (error) {
      logger.error(`Error creating container for sandbox ${sandboxId}:`, error);
      throw error;
    }
  }

  async startContainer(containerId) {
    try {
      const container = this.docker.getContainer(containerId);
      await container.start();
      logger.info(`Container started: ${containerId}`);

      // Wait a moment for the container to initialize
      await new Promise(resolve => setTimeout(resolve, 5000));

      return container;
    } catch (error) {
      logger.error(`Error starting container ${containerId}:`, error);
      throw error;
    }
  }

  async stopContainer(containerId) {
    try {
      const container = this.docker.getContainer(containerId);
      await container.stop({ timeout: 30 });
      logger.info(`Container stopped: ${containerId}`);
      return container;
    } catch (error) {
      logger.error(`Error stopping container ${containerId}:`, error);
      throw error;
    }
  }

  async restartContainer(containerId) {
    try {
      const container = this.docker.getContainer(containerId);
      await container.restart({ timeout: 30 });
      logger.info(`Container restarted: ${containerId}`);

      // Wait for container to initialize
      await new Promise(resolve => setTimeout(resolve, 10000));

      return container;
    } catch (error) {
      logger.error(`Error restarting container ${containerId}:`, error);
      throw error;
    }
  }

  async removeContainer(containerId) {
    try {
      const container = this.docker.getContainer(containerId);
      await container.remove({ force: true, v: true });
      logger.info(`Container removed: ${containerId}`);
    } catch (error) {
      logger.error(`Error removing container ${containerId}:`, error);
      throw error;
    }
  }

  async getContainerInfo(containerId) {
    try {
      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();

      return {
        id: info.Id,
        name: info.Name,
        status: info.State.Status,
        created: info.Created,
        started: info.State.StartedAt,
        finished: info.State.FinishedAt,
        exit_code: info.State.ExitCode,
        ports: info.NetworkSettings.Ports,
        mounts: info.Mounts,
        image: info.Config.Image,
        env: info.Config.Env
      };
    } catch (error) {
      logger.error(`Error getting container info for ${containerId}:`, error);
      throw error;
    }
  }

  async getContainerNetworkInfo(containerId) {
    try {
      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();

      // Get port bindings
      const adbPort = info.NetworkSettings.Ports['5555/tcp']?.[0]?.HostPort;
      const vncPort = info.NetworkSettings.Ports['5900/tcp']?.[0]?.HostPort;

      // Get IP address
      let ipAddress = null;
      const networks = info.NetworkSettings.Networks;

      // Look for custom network first, then management network
      for (const networkName of Object.keys(networks)) {
        if (networkName.includes('instance') || networkName.includes('mgmt')) {
          ipAddress = networks[networkName].IPAddress;
          break;
        }
      }

      return {
        ip_address: ipAddress,
        adb_port: adbPort ? parseInt(adbPort) : null,
        vnc_port: vncPort ? parseInt(vncPort) : null,
        networks: Object.keys(networks)
      };
    } catch (error) {
      logger.error(`Error getting network info for container ${containerId}:`, error);
      throw error;
    }
  }

  async getContainerLogs(containerId, options = {}) {
    try {
      const container = this.docker.getContainer(containerId);
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        timestamps: true,
        tail: options.lines || 100,
        follow: options.follow || false
      });

      return logs;
    } catch (error) {
      logger.error(`Error getting logs for container ${containerId}:`, error);
      throw error;
    }
  }

  async createCustomNetwork(networkName, networkConfig) {
    try {
      // Create custom bridge network
      const networkConfigOptions = {
        Name: networkName,
        Driver: 'bridge',
        IPAM: {
          Driver: 'default',
          Config: [
            {
              Subnet: networkConfig.ip_range || '192.168.100.0/24',
              Gateway: networkConfig.gateway || '192.168.100.1'
            }
          ]
        },
        Options: {
          'com.docker.network.bridge.name': `br-${networkName}`,
          'com.docker.network.bridge.enable_icc': 'false',
          'com.docker.network.bridge.enable_ip_masquerade': 'true'
        }
      };

      const network = await this.docker.createNetwork(networkConfigOptions);
      logger.info(`Custom network created: ${networkName}`);

      return network;
    } catch (error) {
      if (error.statusCode === 409) {
        logger.warn(`Network ${networkName} already exists`);
        return this.docker.getNetwork(networkName);
      }
      logger.error(`Error creating custom network ${networkName}:`, error);
      throw error;
    }
  }

  async removeCustomNetwork(networkName) {
    try {
      const network = this.docker.getNetwork(networkName);
      await network.remove();
      logger.info(`Custom network removed: ${networkName}`);
    } catch (error) {
      logger.error(`Error removing custom network ${networkName}:`, error);
      // Don't throw error, just log it
    }
  }

  async updateNetworkConfig(sandboxId, networkConfig) {
    try {
      // Update network conditions if specified
      if (networkConfig.bandwidth_kbps || networkConfig.latency_ms || networkConfig.packet_loss_percent) {
        const scriptPath = path.join(__dirname, '../../network/simulate-conditions.sh');
        const bridgeName = `br-sandbox-${sandboxId}`;

        let command = `sudo ${scriptPath} sandbox ${sandboxId}`;

        if (networkConfig.latency_ms) {
          command += ` latency ${networkConfig.latency_ms}`;
        }
        if (networkConfig.packet_loss_percent) {
          command += ` loss ${networkConfig.packet_loss_percent}`;
        }
        if (networkConfig.bandwidth_kbps) {
          command += ` bandwidth ${networkConfig.bandwidth_kbps}`;
        }

        const { exec } = require('child_process');
        await new Promise((resolve, reject) => {
          exec(command, (error, stdout, stderr) => {
            if (error) {
              logger.error(`Error updating network conditions: ${error.message}`);
              reject(error);
            } else {
              logger.info(`Network conditions updated for sandbox ${sandboxId}`);
              resolve(stdout);
            }
          });
        });
      }
    } catch (error) {
      logger.error(`Error updating network config for sandbox ${sandboxId}:`, error);
      throw error;
    }
  }

  async updateAnalysisTools(sandboxId, tools) {
    try {
      const container = this.docker.getContainer(`android-sandbox-${sandboxId}`);

      // Start/stop analysis tools based on configuration
      const execOptions = { Cmd: ['/bin/bash'] };

      if (tools.includes('frida')) {
        await container.exec({
          Cmd: ['pgrep', '-f', 'frida'],
          ...execOptions
        });
      }

      if (tools.includes('tcpdump')) {
        await container.exec({
          Cmd: ['pgrep', '-f', 'tcpdump'],
          ...execOptions
        });
      }

      logger.info(`Analysis tools updated for sandbox ${sandboxId}`);
    } catch (error) {
      logger.error(`Error updating analysis tools for sandbox ${sandboxId}:`, error);
      throw error;
    }
  }

  async loadDeviceTemplate(deviceProfile) {
    try {
      const templatePath = path.join(this.configDir, 'device-templates', `${deviceProfile}.yml`);
      const templateContent = await fs.readFile(templatePath, 'utf8');
      return yaml.parse(templateContent);
    } catch (error) {
      logger.error(`Error loading device template ${deviceProfile}:`, error);
      // Return default template
      return {
        name: 'Default Device',
        android: { version: '12', api_level: 31 },
        hardware: { ram_mb: 4096, storage_gb: 64 }
      };
    }
  }

  async loadNetworkProfile(profileName) {
    try {
      const profilePath = path.join(this.configDir, 'network-profiles', `${profileName}.yml`);
      const profileContent = await fs.readFile(profilePath, 'utf8');
      return yaml.parse(profileContent);
    } catch (error) {
      logger.error(`Error loading network profile ${profileName}:`, error);
      // Return default profile
      return {
        name: 'Standard Network',
        type: 'bridge'
      };
    }
  }

  async loadSecurityPolicy(policyName) {
    try {
      const policyPath = path.join(this.configDir, 'security-policies', `${policyName}.yml`);
      const policyContent = await fs.readFile(policyPath, 'utf8');
      return yaml.parse(policyContent);
    } catch (error) {
      logger.error(`Error loading security policy ${policyName}:`, error);
      // Return default policy
      return {
        name: 'Standard Security',
        device: { selinux: 'permissive' }
      };
    }
  }

  async getSystemInfo() {
    try {
      const info = await this.docker.info();
      const version = await this.docker.version();

      return {
        docker: {
          version: version.Version,
          api_version: version.ApiVersion,
          arch: version.Arch,
          os: version.Os
        },
        system: {
          containers: info.Containers,
          containers_running: info.ContainersRunning,
          containers_paused: info.ContainersPaused,
          containers_stopped: info.ContainersStopped,
          images: info.Images,
          memory_total: info.MemTotal,
          cpu_count: info.NCPU
        }
      };
    } catch (error) {
      logger.error('Error getting Docker system info:', error);
      throw error;
    }
  }

  async listContainers(filters = {}) {
    try {
      const containers = await this.docker.listContainers({ all: true, filters });
      return containers.map(container => ({
        id: container.Id,
        name: container.Names[0],
        image: container.Image,
        status: container.Status,
        created: container.Created,
        ports: container.Ports,
        labels: container.Labels
      }));
    } catch (error) {
      logger.error('Error listing containers:', error);
      throw error;
    }
  }
}

module.exports = new DockerService();