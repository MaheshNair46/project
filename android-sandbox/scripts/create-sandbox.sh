#!/bin/bash

# Create Android Sandbox Script
# Creates a new Android sandbox instance with specified configuration

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$(dirname "$SCRIPT_DIR")/config"
TOOLS_DIR="$(dirname "$SCRIPT_DIR")/tools"
NETWORK_DIR="$(dirname "$SCRIPT_DIR")/network"
DEFAULT_NAME="sandbox-$(date +%Y%m%d-%H%M%S)"
DEFAULT_ANDROID_VERSION="12"
DEFAULT_DEVICE_PROFILE="pixel-5"
DEFAULT_SECURITY_POLICY="analysis-mode"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

debug() {
    if [[ "$DEBUG" == "true" ]]; then
        echo -e "${BLUE}[DEBUG]${NC} $1"
    fi
}

# Show usage information
show_usage() {
    cat << EOF
Android Sandbox Creation Script

Usage: $0 [OPTIONS]

OPTIONS:
    -n, --name NAME              Sandbox name (default: $DEFAULT_NAME)
    -v, --android-version VER    Android version (default: $DEFAULT_ANDROID_VERSION)
    -d, --device-profile PROFILE Device profile (default: $DEFAULT_DEVICE_PROFILE)
    -s, --security-policy POLICY Security policy (default: $DEFAULT_SECURITY_POLICY)
    -i, --ip-address IP          Static IP address (optional)
    -p, --proxy PROXY           HTTP proxy (optional)
    -t, --tools TOOLS           Analysis tools (comma-separated, default: logcat)
    -r, --ram SIZE              RAM size in MB (default: 4096)
    -c, --cpu LIMIT             CPU limit percentage (default: 50)
    --auto-start                Auto-start sandbox after creation
    --tags TAGS                 Tags for organization (comma-separated)
    --config-file FILE          Load configuration from YAML file
    --dry-run                   Show configuration without creating
    --help                      Show this help message

EXAMPLES:
    $0 --name "malware-analysis" --android-version 12 --security-policy analysis-mode
    $0 --name "app-testing" --ip-address 192.168.100.10 --tools "frida,tcpdump"
    $0 --config-file my-sandbox-config.yml --auto-start

DEVICE PROFILES:
    pixel-5      Google Pixel 5 (Android 12)
    samsung-s21  Samsung Galaxy S21 (Android 11)

SECURITY POLICIES:
    analysis-mode    Permissive security for malware analysis
    stealth-mode     Evasion-focused analysis

ANALYSIS TOOLS:
    frida    Dynamic instrumentation
    tcpdump  Network traffic capture
    strace   System call tracing
    logcat   Android logging
EOF
}

# Parse command line arguments
parse_arguments() {
    NAME="$DEFAULT_NAME"
    ANDROID_VERSION="$DEFAULT_ANDROID_VERSION"
    DEVICE_PROFILE="$DEFAULT_DEVICE_PROFILE"
    SECURITY_POLICY="$DEFAULT_SECURITY_POLICY"
    IP_ADDRESS=""
    PROXY=""
    TOOLS="logcat"
    RAM_SIZE="4096"
    CPU_LIMIT="50"
    AUTO_START="false"
    TAGS=""
    CONFIG_FILE=""
    DRY_RUN="false"

    while [[ $# -gt 0 ]]; do
        case $1 in
            -n|--name)
                NAME="$2"
                shift 2
                ;;
            -v|--android-version)
                ANDROID_VERSION="$2"
                shift 2
                ;;
            -d|--device-profile)
                DEVICE_PROFILE="$2"
                shift 2
                ;;
            -s|--security-policy)
                SECURITY_POLICY="$2"
                shift 2
                ;;
            -i|--ip-address)
                IP_ADDRESS="$2"
                shift 2
                ;;
            -p|--proxy)
                PROXY="$2"
                shift 2
                ;;
            -t|--tools)
                TOOLS="$2"
                shift 2
                ;;
            -r|--ram)
                RAM_SIZE="$2"
                shift 2
                ;;
            -c|--cpu)
                CPU_LIMIT="$2"
                shift 2
                ;;
            --auto-start)
                AUTO_START="true"
                shift
                ;;
            --tags)
                TAGS="$2"
                shift 2
                ;;
            --config-file)
                CONFIG_FILE="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN="true"
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                ;;
        esac
    done
}

# Load configuration from YAML file
load_config_file() {
    if [[ -n "$CONFIG_FILE" ]]; then
        if [[ ! -f "$CONFIG_FILE" ]]; then
            error "Configuration file not found: $CONFIG_FILE"
        fi

        log "Loading configuration from: $CONFIG_FILE"

        # Parse YAML using basic tools (simplified)
        if command -v python3 > /dev/null 2>&1; then
            python3 -c "
import yaml
import sys
import json

try:
    with open('$CONFIG_FILE', 'r') as f:
        config = yaml.safe_load(f)

    # Extract configuration values
    name = config.get('name', '$NAME')
    android_version = config.get('android_version', '$ANDROID_VERSION')
    device_profile = config.get('device_profile', '$DEVICE_PROFILE')
    security_policy = config.get('security_policy', '$SECURITY_POLICY')

    network_config = config.get('network_config', {})
    ip_address = network_config.get('ip_address', '$IP_ADDRESS')
    proxy = network_config.get('proxy', '$PROXY')

    analysis_tools = config.get('analysis_tools', '$TOOLS')
    ram_mb = config.get('hardware', {}).get('ram_mb', '$RAM_SIZE')
    cpu_limit = config.get('hardware', {}).get('cpu_limit', '$CPU_LIMIT')
    auto_start = config.get('auto_start', '$AUTO_START')
    tags = config.get('tags', '$TAGS')

    # Generate environment variables
    print(f'NAME={name}')
    print(f'ANDROID_VERSION={android_version}')
    print(f'DEVICE_PROFILE={device_profile}')
    print(f'SECURITY_POLICY={security_policy}')
    print(f'IP_ADDRESS={ip_address}')
    print(f'PROXY={proxy}')
    print(f'TOOLS={\",\".join(analysis_tools) if isinstance(analysis_tools, list) else analysis_tools}')
    print(f'RAM_SIZE={ram_mb}')
    print(f'CPU_LIMIT={cpu_limit}')
    print(f'AUTO_START={str(auto_start).lower()}')
    print(f'TAGS={\",\".join(tags) if isinstance(tags, list) else tags}')

except Exception as e:
    print(f'Error parsing config file: {e}', file=sys.stderr)
    sys.exit(1)
"
        else
            warn "Python3 not found, using basic YAML parsing"
            # Basic YAML parsing (very limited)
            NAME=$(grep "^name:" "$CONFIG_FILE" | cut -d: -f2 | xargs || echo "$NAME")
            ANDROID_VERSION=$(grep "^android_version:" "$CONFIG_FILE" | cut -d: -f2 | xargs || echo "$ANDROID_VERSION")
            DEVICE_PROFILE=$(grep "^device_profile:" "$CONFIG_FILE" | cut -d: -f2 | xargs || echo "$DEVICE_PROFILE")
            SECURITY_POLICY=$(grep "^security_policy:" "$CONFIG_FILE" | cut -d: -f2 | xargs || echo "$SECURITY_POLICY")
        fi
    fi
}

# Validate configuration
validate_config() {
    log "Validating configuration..."

    # Validate Android version
    if [[ ! "$ANDROID_VERSION" =~ ^(11|12|13)$ ]]; then
        error "Invalid Android version: $ANDROID_VERSION. Must be 11, 12, or 13"
    fi

    # Validate device profile
    local device_template_file="$CONFIG_DIR/device-templates/${DEVICE_PROFILE}.yml"
    if [[ ! -f "$device_template_file" ]]; then
        error "Device profile not found: $DEVICE_PROFILE"
    fi

    # Validate security policy
    local security_policy_file="$CONFIG_DIR/security-policies/${SECURITY_POLICY}.yml"
    if [[ ! -f "$security_policy_file" ]]; then
        error "Security policy not found: $SECURITY_POLICY"
    fi

    # Validate IP address if provided
    if [[ -n "$IP_ADDRESS" ]] && [[ ! "$IP_ADDRESS" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        error "Invalid IP address format: $IP_ADDRESS"
    fi

    # Validate RAM size
    if [[ ! "$RAM_SIZE" =~ ^[0-9]+$ ]] || [[ "$RAM_SIZE" -lt 1024 ]] || [[ "$RAM_SIZE" -gt 16384 ]]; then
        error "Invalid RAM size: $RAM_SIZE. Must be between 1024 and 16384 MB"
    fi

    # Validate CPU limit
    if [[ ! "$CPU_LIMIT" =~ ^[0-9]+$ ]] || [[ "$CPU_LIMIT" -lt 10 ]] || [[ "$CPU_LIMIT" -gt 100 ]]; then
        error "Invalid CPU limit: $CPU_LIMIT. Must be between 10 and 100 percent"
    fi

    # Validate analysis tools
    local valid_tools="frida,tcpdump,strace,logcat"
    for tool in ${TOOLS//,/ }; do
        if [[ ! "$valid_tools" =~ $tool ]]; then
            error "Invalid analysis tool: $tool. Valid tools: $valid_tools"
        fi
    done

    log "Configuration validation completed"
}

# Show configuration summary
show_config_summary() {
    echo ""
    echo "=== Sandbox Configuration Summary ==="
    echo "Name: $NAME"
    echo "Android Version: $ANDROID_VERSION"
    echo "Device Profile: $DEVICE_PROFILE"
    echo "Security Policy: $SECURITY_POLICY"
    echo "RAM Size: ${RAM_SIZE}MB"
    echo "CPU Limit: ${CPU_LIMIT}%"
    echo "Analysis Tools: $TOOLS"
    if [[ -n "$IP_ADDRESS" ]]; then
        echo "IP Address: $IP_ADDRESS"
    fi
    if [[ -n "$PROXY" ]]; then
        echo "Proxy: $PROXY"
    fi
    if [[ -n "$TAGS" ]]; then
        echo "Tags: $TAGS"
    fi
    echo "Auto Start: $AUTO_START"
    echo "===================================="
    echo ""
}

# Create sandbox configuration JSON
create_sandbox_config() {
    local config_json=$(cat << EOF
{
    "name": "$NAME",
    "android_version": "$ANDROID_VERSION",
    "device_profile": "$DEVICE_PROFILE",
    "security_policy": "$SECURITY_POLICY",
    "ram_mb": $RAM_SIZE,
    "cpu_limit": $CPU_LIMIT,
    "analysis_tools": [$(echo "$TOOLS" | sed 's/,/","/g' | sed 's/^/"/' | sed 's/$/"/')],
    "network_config": {
EOF
)

    if [[ -n "$IP_ADDRESS" ]]; then
        config_json+=$(cat << EOF
        "ip_address": "$IP_ADDRESS",
EOF
)
    fi

    if [[ -n "$PROXY" ]]; then
        config_json+=$(cat << EOF
        "proxy": "$PROXY",
EOF
)
    fi

    config_json+=$(cat << EOF
        "dns_servers": ["8.8.8.8", "8.8.4.4"]
    },
    "auto_start": $AUTO_START,
    "tags": [$(if [[ -n "$TAGS" ]]; then echo "$TAGS" | sed 's/,/","/g' | sed 's/^/"/' | sed 's/$/"/'; else echo ""; fi)]
}
EOF
)

    echo "$config_json"
}

# Create sandbox via API
create_sandbox() {
    log "Creating sandbox: $NAME"

    local config_json
    config_json=$(create_sandbox_config)

    debug "Sandbox configuration:"
    debug "$config_json"

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would create sandbox with configuration:"
        echo "$config_json"
        return
    fi

    # Create sandbox using API
    local api_url="http://localhost:3000/api/v1/sandboxes"
    local response

    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $API_TOKEN" \
        -d "$config_json" \
        "$api_url")

    local http_code=$(echo "$response" | tail -n1)
    local response_body=$(echo "$response" | head -n -1)

    if [[ "$http_code" -eq 201 ]]; then
        local sandbox_id=$(echo "$response_body" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null || echo "unknown")
        local adb_port=$(echo "$response_body" | python3 -c "import sys, json; print(json.load(sys.stdin)['data'].get('adb_port', 'N/A'))" 2>/dev/null || echo "N/A")
        local vnc_port=$(echo "$response_body" | python3 -c "import sys, json; print(json.load(sys.stdin)['data'].get('vnc_port', 'N/A'))" 2>/dev/null || echo "N/A")

        log "Sandbox created successfully!"
        log "Sandbox ID: $sandbox_id"
        if [[ "$adb_port" != "N/A" ]]; then
            log "ADB Port: $adb_port"
        fi
        if [[ "$vnc_port" != "N/A" ]]; then
            log "VNC Port: $vnc_port"
        fi

        # Show connection instructions
        echo ""
        echo "=== Connection Instructions ==="
        echo "ADB: adb connect localhost:$adb_port"
        echo "VNC: vnc://localhost:$vnc_port"
        if [[ "$AUTO_START" == "true" ]]; then
            echo "Status: Sandbox is starting..."
        else
            echo "Status: Sandbox created but not started. Start it via the web interface or API."
        fi
        echo "=============================="

    else
        error "Failed to create sandbox. HTTP $http_code: $response_body"
    fi
}

# Check prerequisites
check_prerequisites() {
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        error "Docker is not running or not accessible"
    fi

    # Check if API server is running
    if ! curl -s http://localhost:3000/api/v1/health > /dev/null 2>&1; then
        error "API server is not running. Please start it with: docker-compose up -d"
    fi

    # Check API token if not provided
    if [[ -z "$API_TOKEN" ]]; then
        warn "API_TOKEN not set. Using anonymous access."
        warn "Set API_TOKEN environment variable for authenticated access."
    fi

    # Check required tools
    if ! command -v curl > /dev/null 2>&1; then
        error "curl is required but not installed"
    fi

    log "Prerequisites check completed"
}

# Main function
main() {
    parse_arguments "$@"
    load_config_file
    validate_config
    check_prerequisites
    show_config_summary
    create_sandbox
}

# Run main function with all arguments
main "$@"