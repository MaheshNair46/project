#!/bin/bash

# Network Setup Script for Android Sandbox
# Creates isolated bridge networks for sandbox instances

set -e

# Configuration
MANAGEMENT_NETWORK="android-sandbox-mgmt"
SANDBOX_NETWORK_BASE="android-sandbox-instance"
MANAGEMENT_SUBNET="172.20.0.0/16"
SANDBOX_SUBNET_BASE="192.168."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        error "Docker is not running or not accessible"
    fi
    log "Docker is running"
}

# Create management network
create_management_network() {
    log "Creating management network: $MANAGEMENT_NETWORK"

    if docker network ls | grep -q "$MANAGEMENT_NETWORK"; then
        warn "Management network already exists"
        return
    fi

    docker network create \
        --driver bridge \
        --subnet="$MANAGEMENT_SUBNET" \
        --opt com.docker.network.bridge.name=br-sandbox-mgmt \
        --opt com.docker.network.bridge.enable_icc=true \
        --opt com.docker.network.bridge.enable_ip_masquerade=true \
        "$MANAGEMENT_NETWORK"

    log "Management network created successfully"
}

# Create sandbox instance network
create_sandbox_network() {
    local instance_id=$1
    local subnet_suffix=$2
    local network_name="${SANDBOX_NETWORK_BASE}-${instance_id}"
    local subnet="${SANDBOX_SUBNET_BASE}${subnet_suffix}.0/24"
    local gateway="${SANDBOX_SUBNET_BASE}${subnet_suffix}.1"

    log "Creating sandbox network: $network_name (subnet: $subnet)"

    if docker network ls | grep -q "$network_name"; then
        warn "Sandbox network $network_name already exists"
        return
    fi

    docker network create \
        --driver bridge \
        --subnet="$subnet" \
        --gateway="$gateway" \
        --opt com.docker.network.bridge.name="br-sandbox-${instance_id}" \
        --opt com.docker.network.bridge.enable_icc=false \
        --opt com.docker.network.bridge.enable_ip_masquerade=true \
        --opt com.docker.network.bridge.host_binding_ipv4="0.0.0.0" \
        "$network_name"

    log "Sandbox network $network_name created successfully"
    echo "$network_name"
}

# Delete network
delete_network() {
    local network_name=$1

    log "Deleting network: $network_name"

    if ! docker network ls | grep -q "$network_name"; then
        warn "Network $network_name does not exist"
        return
    fi

    # Check if any containers are connected
    local connected_containers
    connected_containers=$(docker network inspect -f '{{range .Containers}}{{.Name}} {{end}}' "$network_name" 2>/dev/null || echo "")

    if [[ -n "$connected_containers" ]]; then
        warn "Network $network_name has connected containers: $connected_containers"
        log "Disconnecting containers..."

        for container in $connected_containers; do
            docker network disconnect "$network_name" "$container" || true
        done
    fi

    docker network rm "$network_name"
    log "Network $network_name deleted successfully"
}

# List networks
list_networks() {
    log "Listing Android sandbox networks:"
    echo ""

    docker network ls | grep -E "(android-sandbox|br-sandbox)" | while IFS= read -r line; do
        local network_name=$(echo "$line" | awk '{print $2}')
        local network_id=$(echo "$line" | awk '{print $1}')

        echo "Network: $network_name (ID: $network_id)"

        # Show network details
        docker network inspect "$network_name" --format '{{range .IPAM.Config}}Subnet: {{.Subnet}}, Gateway: {{.Gateway}}{{end}}' 2>/dev/null || echo "  Subnet: N/A"

        # Show connected containers
        local containers
        containers=$(docker network inspect -f '{{range .Containers}}{{.Name}} ({{.IPv4Address}}) {{end}}' "$network_name" 2>/dev/null || echo "None")
        echo "  Containers: $containers"
        echo ""
    done
}

# Configure network routing for sandbox instances
configure_routing() {
    local instance_id=$1
    local network_name="${SANDBOX_NETWORK_BASE}-${instance_id}"

    log "Configuring routing for network: $network_name"

    # Get the bridge interface name
    local bridge_name
    bridge_name=$(docker network inspect "$network_name" --format '{{.Options["com.docker.network.bridge.name"]}}' 2>/dev/null || echo "br-$instance_id")

    # Enable IP forwarding on the bridge
    sudo sysctl -w net.ipv4.ip_forward=1

    # Add iptables rules for network isolation and monitoring
    sudo iptables -A FORWARD -i "$bridge_name" -j ACCEPT
    sudo iptables -A FORWARD -o "$bridge_name" -j ACCEPT

    # Add NAT rules for internet access
    sudo iptables -t nat -A POSTROUTING -s "$(docker network inspect "$network_name" --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}')" -j MASQUERADE

    log "Routing configured for $network_name"
}

# Clean up all sandbox networks
cleanup_networks() {
    log "Cleaning up all Android sandbox networks"

    # Get all sandbox networks
    local networks
    networks=$(docker network ls | grep -E "(android-sandbox|br-sandbox)" | awk '{print $2}' || true)

    if [[ -z "$networks" ]]; then
        log "No sandbox networks found"
        return
    fi

    for network in $networks; do
        delete_network "$network"
    done

    log "All sandbox networks cleaned up"
}

# Main function
main() {
    case "${1:-help}" in
        "init")
            check_docker
            create_management_network
            ;;
        "create")
            check_docker
            if [[ $# -lt 3 ]]; then
                error "Usage: $0 create <instance_id> <subnet_suffix>"
            fi
            create_sandbox_network "$2" "$3"
            configure_routing "$2"
            ;;
        "delete")
            check_docker
            if [[ $# -lt 2 ]]; then
                error "Usage: $0 delete <network_name>"
            fi
            delete_network "$2"
            ;;
        "list")
            check_docker
            list_networks
            ;;
        "cleanup")
            check_docker
            cleanup_networks
            ;;
        "help"|*)
            echo "Android Sandbox Network Management"
            echo ""
            echo "Usage: $0 <command> [options]"
            echo ""
            echo "Commands:"
            echo "  init                          Initialize management network"
            echo "  create <instance_id> <subnet> Create sandbox network"
            echo "  delete <network_name>        Delete network"
            echo "  list                          List all networks"
            echo "  cleanup                       Clean up all networks"
            echo "  help                          Show this help"
            echo ""
            echo "Examples:"
            echo "  $0 init"
            echo "  $0 create sandbox001 100"
            echo "  $0 delete android-sandbox-instance-sandbox001"
            echo "  $0 list"
            echo "  $0 cleanup"
            ;;
    esac
}

# Run main function with all arguments
main "$@"