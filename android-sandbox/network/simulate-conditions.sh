#!/bin/bash

# Network Conditions Simulation Script
# Simulates various network conditions for testing

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_INTERFACE="eth0"

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
    echo -e "${BLUE}[DEBUG]${NC} $1"
}

# Check if running as root (required for tc)
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root to modify network interfaces"
    fi
}

# Get bridge interface for a sandbox instance
get_bridge_interface() {
    local instance_id=$1
    local network_name="android-sandbox-instance-${instance_id}"

    # Try to get the bridge name from Docker network inspection
    local bridge_name
    bridge_name=$(docker network inspect "$network_name" --format '{{.Options["com.docker.network.bridge.name"]}}' 2>/dev/null || echo "")

    if [[ -z "$bridge_name" ]]; then
        bridge_name="br-sandbox-${instance_id}"
        warn "Could not determine bridge interface, using default: $bridge_name"
    fi

    echo "$bridge_name"
}

# Check if interface exists
check_interface() {
    local interface=$1

    if ! ip link show "$interface" > /dev/null 2>&1; then
        error "Interface $interface does not exist"
    fi

    log "Using interface: $interface"
}

# Clear all existing traffic control rules
clear_rules() {
    local interface=$1

    log "Clearing existing traffic control rules for $interface"

    tc qdisc del dev "$interface" root 2>/dev/null || true
    tc qdisc del dev "$interface" ingress 2>/dev/null || true

    log "Traffic control rules cleared"
}

# Add network latency
add_latency() {
    local interface=$1
    local latency_ms=$2
    local jitter_ms=${3:-0}
    local correlation_percent=${4:-0}

    log "Adding latency: ${latency_ms}ms ±${jitter_ms}ms (correlation: ${correlation_percent}%)"

    tc qdisc add dev "$interface" root handle 1: netem \
        delay "${latency_ms}ms" "${jitter_ms}ms" "${correlation_percent}%"

    log "Latency rules applied"
}

# Add packet loss
add_packet_loss() {
    local interface=$1
    local loss_percent=$2
    local correlation_percent=${3:-0}

    log "Adding packet loss: ${loss_percent}% (correlation: ${correlation_percent}%)"

    # If qdisc already exists, modify it
    if tc qdisc show dev "$interface" | grep -q "netem"; then
        tc qdisc change dev "$interface" root netem \
            loss "${loss_percent}%" "${correlation_percent}%"
    else
        tc qdisc add dev "$interface" root handle 1: netem \
            loss "${loss_percent}%" "${correlation_percent}%"
    fi

    log "Packet loss rules applied"
}

# Add bandwidth limitation
add_bandwidth_limit() {
    local interface=$1
    local bandwidth_kbps=$2

    log "Adding bandwidth limit: ${bandwidth_kbps}kbps"

    # Convert kbps to bits per second for tc
    local bandwidth_bps=$((bandwidth_kbps * 1000))

    # Create HTB qdisc for rate limiting
    tc qdisc add dev "$interface" root handle 1: htb default 30
    tc class add dev "$interface" parent 1: classid 1:1 htb rate "${bandwidth_bps}bps" ceil "${bandwidth_bps}bps"
    tc class add dev "$interface" parent 1:1 classid 1:30 htb rate "${bandwidth_bps}bps" ceil "${bandwidth_bps}bps"

    log "Bandwidth limit applied"
}

# Add packet duplication
add_duplication() {
    local interface=$1
    local duplicate_percent=$2

    log "Adding packet duplication: ${duplicate_percent}%"

    # If qdisc already exists, modify it
    if tc qdisc show dev "$interface" | grep -q "netem"; then
        tc qdisc change dev "$interface" root netem \
            duplicate "${duplicate_percent}%"
    else
        tc qdisc add dev "$interface" root handle 1: netem \
            duplicate "${duplicate_percent}%"
    fi

    log "Packet duplication rules applied"
}

# Add packet corruption
add_corruption() {
    local interface=$1
    local corrupt_percent=$2

    log "Adding packet corruption: ${corrupt_percent}%"

    # If qdisc already exists, modify it
    if tc qdisc show dev "$interface" | grep -q "netem"; then
        tc qdisc change dev "$interface" root netem \
            corrupt "${corrupt_percent}%"
    else
        tc qdisc add dev "$interface" root handle 1: netem \
            corrupt "${corrupt_percent}%"
    fi

    log "Packet corruption rules applied"
}

# Add packet reordering
add_reordering() {
    local interface=$1
    local delay_ms=$2
    local percentage=$3
    local correlation_percent=${4:-0}

    log "Adding packet reordering: ${percentage}% with ${delay_ms}ms delay (correlation: ${correlation_percent}%)"

    # Create a more complex qdisc setup for reordering
    tc qdisc add dev "$interface" root handle 1: prio
    tc qdisc add dev "$interface" parent 1:1 handle 10: netem delay "${delay_ms}ms" limit 1000
    tc filter add dev "$interface" parent 1:0 protocol ip pref 1 u32 \
        match ip dst 0.0.0.0/0 flowid 1:1 \
        probability "${percentage}%"

    log "Packet reordering rules applied"
}

# Apply complex network conditions
apply_complex_conditions() {
    local interface=$1
    local config_file=$2

    log "Applying complex network conditions from: $config_file"

    if [[ ! -f "$config_file" ]]; then
        error "Configuration file not found: $config_file"
    fi

    # Parse YAML-like configuration (simple key-value pairs)
    local latency_ms
    local jitter_ms
    local packet_loss
    local bandwidth_kbps
    local duplicate_percent
    local corrupt_percent

    # Extract values from config file
    latency_ms=$(grep -E "^latency_ms:" "$config_file" | cut -d: -f2 | xargs || echo "0")
    jitter_ms=$(grep -E "^jitter_ms:" "$config_file" | cut -d: -f2 | xargs || echo "0")
    packet_loss=$(grep -E "^packet_loss:" "$config_file" | cut -d: -f2 | xargs || echo "0")
    bandwidth_kbps=$(grep -E "^bandwidth_kbps:" "$config_file" | cut -d: -f2 | xargs || echo "0")
    duplicate_percent=$(grep -E "^duplicate_percent:" "$config_file" | cut -d: -f2 | xargs || echo "0")
    corrupt_percent=$(grep -E "^corrupt_percent:" "$config_file" | cut -d: -f2 | xargs || echo "0")

    # Apply conditions in order
    if [[ "$bandwidth_kbps" != "0" ]]; then
        add_bandwidth_limit "$interface" "$bandwidth_kbps"
    fi

    if [[ "$latency_ms" != "0" ]]; then
        add_latency "$interface" "$latency_ms" "$jitter_ms"
    fi

    if [[ "$packet_loss" != "0" ]]; then
        add_packet_loss "$interface" "$packet_loss"
    fi

    if [[ "$duplicate_percent" != "0" ]]; then
        add_duplication "$interface" "$duplicate_percent"
    fi

    if [[ "$corrupt_percent" != "0" ]]; then
        add_corruption "$interface" "$corrupt_percent"
    fi

    log "Complex network conditions applied"
}

# Show current network conditions
show_status() {
    local interface=$1

    log "Current network conditions for $interface:"
    echo ""

    if tc qdisc show dev "$interface" | grep -q "netem\|htb\|prio"; then
        tc qdisc show dev "$interface"
    else
        echo "No network simulation rules active"
    fi

    echo ""

    # Show interface statistics
    log "Interface statistics:"
    cat /proc/net/dev | grep "$interface" || echo "Interface statistics not available"
}

# Create sample configuration file
create_sample_config() {
    local config_file="$1"

    cat > "$config_file" << 'EOF'
# Network Conditions Configuration
# Values of 0 means the condition is disabled

# Latency configuration (in milliseconds)
latency_ms: 200
jitter_ms: 50

# Packet loss (percentage)
packet_loss: 2

# Bandwidth limit (in kbps, 0 = unlimited)
bandwidth_kbps: 1000

# Packet duplication (percentage)
duplicate_percent: 1

# Packet corruption (percentage)
corrupt_percent: 0.1
EOF

    log "Sample configuration created: $config_file"
}

# Main function
main() {
    case "${1:-help}" in
        "clear")
            check_root
            if [[ $# -lt 2 ]]; then
                error "Usage: $0 clear <interface>"
            fi
            check_interface "$2"
            clear_rules "$2"
            ;;
        "latency")
            check_root
            if [[ $# -lt 3 ]]; then
                error "Usage: $0 latency <interface> <latency_ms> [jitter_ms] [correlation_percent]"
            fi
            check_interface "$2"
            clear_rules "$2"
            add_latency "$2" "$3" "${4:-0}" "${5:-0}"
            ;;
        "loss")
            check_root
            if [[ $# -lt 3 ]]; then
                error "Usage: $0 loss <interface> <loss_percent> [correlation_percent]"
            fi
            check_interface "$2"
            clear_rules "$2"
            add_packet_loss "$2" "$3" "${4:-0}"
            ;;
        "bandwidth")
            check_root
            if [[ $# -lt 3 ]]; then
                error "Usage: $0 bandwidth <interface> <bandwidth_kbps>"
            fi
            check_interface "$2"
            clear_rules "$2"
            add_bandwidth_limit "$2" "$3"
            ;;
        "complex")
            check_root
            if [[ $# -lt 3 ]]; then
                error "Usage: $0 complex <interface> <config_file>"
            fi
            check_interface "$2"
            clear_rules "$2"
            apply_complex_conditions "$2" "$3"
            ;;
        "sandbox")
            check_root
            if [[ $# -lt 3 ]]; then
                error "Usage: $0 sandbox <instance_id> <command> [options...]"
            fi
            local instance_id=$2
            local command=$3
            shift 3

            local bridge_name
            bridge_name=$(get_bridge_interface "$instance_id")

            case "$command" in
                "clear")
                    clear_rules "$bridge_name"
                    ;;
                "latency")
                    add_latency "$bridge_name" "$@"
                    ;;
                "loss")
                    add_packet_loss "$bridge_name" "$@"
                    ;;
                "bandwidth")
                    add_bandwidth_limit "$bridge_name" "$@"
                    ;;
                "status")
                    show_status "$bridge_name"
                    ;;
                *)
                    error "Unknown sandbox command: $command"
                    ;;
            esac
            ;;
        "status")
            if [[ $# -lt 2 ]]; then
                error "Usage: $0 status <interface>"
            fi
            check_interface "$2"
            show_status "$2"
            ;;
        "sample-config")
            if [[ $# -lt 2 ]]; then
                error "Usage: $0 sample-config <config_file>"
            fi
            create_sample_config "$2"
            ;;
        "help"|*)
            echo "Network Conditions Simulation Tool"
            echo ""
            echo "Usage: $0 <command> [options]"
            echo ""
            echo "Commands:"
            echo "  clear <interface>                                    Clear all simulation rules"
            echo "  latency <interface> <ms> [jitter] [correlation]     Add latency"
            echo "  loss <interface> <percent> [correlation]            Add packet loss"
            echo "  bandwidth <interface> <kbps>                        Limit bandwidth"
            echo "  complex <interface> <config_file>                   Apply complex conditions"
            echo "  sandbox <instance_id> <command> [options...]       Apply to sandbox instance"
            echo "  status <interface>                                  Show current status"
            echo "  sample-config <config_file>                         Create sample config"
            echo "  help                                                Show this help"
            echo ""
            echo "Examples:"
            echo "  $0 clear eth0"
            echo "  $0 latency eth0 200 50"
            echo "  $0 loss eth0 5"
            echo "  $0 bandwidth eth0 1000"
            echo "  $0 sandbox sandbox001 latency 100 25"
            echo "  $0 status eth0"
            echo "  $0 sample-config network-conditions.yml"
            ;;
    esac
}

# Run main function with all arguments
main "$@"