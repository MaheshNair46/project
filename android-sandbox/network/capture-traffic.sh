#!/bin/bash

# Traffic Capture Script for Android Sandbox
# Captures and analyzes network traffic from sandbox instances

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAPTURES_DIR="/opt/captures"
DEFAULT_INTERFACE="eth0"
DEFAULT_DURATION=300
MAX_CAPTURE_SIZE="100M"

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

# Check if running as root (required for tcpdump)
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root to capture network traffic"
    fi
}

# Create captures directory
setup_captures_dir() {
    if [[ ! -d "$CAPTURES_DIR" ]]; then
        mkdir -p "$CAPTURES_DIR"
        chmod 755 "$CAPTURES_DIR"
        log "Created captures directory: $CAPTURES_DIR"
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

# Check if tcpdump is available
check_tcpdump() {
    if ! command -v tcpdump > /dev/null 2>&1; then
        error "tcpdump is not installed. Please install it with: apt-get install tcpdump"
    fi
}

# Generate capture filename
generate_capture_filename() {
    local instance_id=$1
    local filter_desc=$2
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local sanitized_filter=$(echo "$filter_desc" | tr ' ' '_' | tr -d '()[],/' | tr '[:upper:]' '[:lower:]')

    if [[ -n "$instance_id" ]]; then
        echo "${CAPTURES_DIR}/sandbox-${instance_id}-${timestamp}-${sanitized_filter}.pcap"
    else
        echo "${CAPTURES_DIR}/capture-${timestamp}-${sanitized_filter}.pcap"
    fi
}

# Start traffic capture
start_capture() {
    local interface=$1
    local output_file=$2
    local filter=$3
    local duration=${4:-0}
    local max_size=${5:-$MAX_CAPTURE_SIZE}

    log "Starting traffic capture on $interface"
    log "Output file: $output_file"

    if [[ -n "$filter" ]]; then
        log "Filter: $filter"
    else
        log "Filter: none (capturing all traffic)"
    fi

    if [[ "$duration" -gt 0 ]]; then
        log "Duration: ${duration} seconds"
    fi

    # Build tcpdump command
    local tcpdump_cmd="tcpdump -i $interface -w $output_file -C $max_size"

    # Add filter if provided
    if [[ -n "$filter" ]]; then
        tcpdump_cmd="$tcpdump_cmd \"$filter\""
    fi

    # Add duration if specified
    if [[ "$duration" -gt 0 ]]; then
        tcpdump_cmd="timeout $duration $tcpdump_cmd"
    else
        tcpdump_cmd="$tcpdump_cmd &"
    fi

    log "Executing: $tcpdump_cmd"

    # Start capture
    eval "$tcpdump_cmd"
    local tcpdump_pid=$!

    if [[ "$duration" -eq 0 ]]; then
        log "Traffic capture started (PID: $tcpdump_pid)"
        echo "$tcpdump_pid"
    else
        wait $tcpdump_pid
        log "Traffic capture completed"
    fi
}

# Stop traffic capture
stop_capture() {
    local pid=$1

    log "Stopping traffic capture (PID: $pid)"

    if kill -0 "$pid" 2>/dev/null; then
        kill "$pid"
        # Give it a moment to finish gracefully
        sleep 2
        if kill -0 "$pid" 2>/dev/null; then
            warn "Process still running, force killing..."
            kill -9 "$pid"
        fi
        log "Traffic capture stopped"
    else
        warn "Process $pid is not running"
    fi
}

# List active captures
list_captures() {
    log "Active traffic captures:"
    echo ""

    local found=false

    # Look for tcpdump processes
    while IFS= read -r line; do
        if [[ "$line" =~ tcpdump.*-w[[:space:]]+([^[:space:]]+) ]]; then
            local capture_file="${BASH_REMATCH[1]}"
            local pid=$(echo "$line" | awk '{print $1}')
            local cmd=$(echo "$line" | cut -d' ' -f4-)

            echo "PID: $pid"
            echo "File: $capture_file"
            echo "Command: $cmd"
            echo "Size: $(du -h "$capture_file" 2>/dev/null | cut -f1 || echo "N/A")"
            echo ""

            found=true
        fi
    done <<< "$(ps aux | grep tcpdump | grep -v grep)"

    if [[ "$found" == false ]]; then
        echo "No active traffic captures found"
    fi
}

# List capture files
list_capture_files() {
    log "Capture files in $CAPTURES_DIR:"
    echo ""

    if [[ ! -d "$CAPTURES_DIR" ]] || [[ -z "$(ls -A "$CAPTURES_DIR" 2>/dev/null)" ]]; then
        echo "No capture files found"
        return
    fi

    # Sort files by modification time (newest first)
    ls -laht "$CAPTURES_DIR"/*.pcap 2>/dev/null | while IFS= read -r line; do
        local file=$(echo "$line" | awk '{print $NF}')
        local size=$(echo "$line" | awk '{print $5}')
        local date=$(echo "$line" | awk '{print $6, $7, $8}')
        local filename=$(basename "$file")

        # Format size
        if [[ "$size" -gt 1048576 ]]; then
            size=$((size / 1048576))MB
        elif [[ "$size" -gt 1024 ]]; then
            size=$((size / 1024))KB
        else
            size=${size}B
        fi

        echo "File: $filename"
        echo "Size: $size"
        echo "Created: $date"
        echo "Path: $file"
        echo ""
    done
}

# Analyze capture file
analyze_capture() {
    local capture_file=$1
    local analysis_type=${2:-summary}

    if [[ ! -f "$capture_file" ]]; then
        error "Capture file not found: $capture_file"
    fi

    log "Analyzing capture file: $capture_file"

    case "$analysis_type" in
        "summary")
            log "Capture summary:"
            tcpdump -r "$capture_file" -q -nn | head -20
            echo "..."
            echo "Total packets: $(tcpdump -r "$capture_file" 2>/dev/null | wc -l)"
            ;;
        "protocols")
            log "Protocol analysis:"
            tcpdump -r "$capture_file" -nn -q | awk '{print $1}' | sort | uniq -c | sort -nr
            ;;
        "hosts")
            log "Host communication analysis:"
            tcpdump -r "$capture_file" -nn -q | awk '{print $3, $5}' | sort | uniq -c | sort -nr | head -20
            ;;
        "dns")
            log "DNS queries:"
            tcpdump -r "$capture_file" -nn -A 'port 53' 2>/dev/null | grep -E "(A|AAAA|CNAME|MX|NS|TXT)" | head -20
            ;;
        "http")
            log "HTTP traffic:"
            tcpdump -r "$capture_file" -nn -A 'port 80 or port 8080' 2>/dev/null | grep -E "(GET|POST|PUT|DELETE|Host:|User-Agent:)" | head -20
            ;;
        "https")
            log "HTTPS/TLS traffic:"
            tcpdump -r "$capture_file" -nn 'port 443' 2>/dev/null | head -20
            ;;
        *)
            warn "Unknown analysis type: $analysis_type"
            echo "Available types: summary, protocols, hosts, dns, http, https"
            ;;
    esac
}

# Convert capture to different formats
convert_capture() {
    local input_file=$1
    local output_file=$2
    local format=${3:-txt}

    if [[ ! -f "$input_file" ]]; then
        error "Input file not found: $input_file"
    fi

    log "Converting capture to $format format"

    case "$format" in
        "txt")
            tcpdump -r "$input_file" -nn > "$output_file"
            ;;
        "json")
            # This would require tshark from wireshark
            if command -v tshark > /dev/null 2>&1; then
                tshark -r "$input_file" -T json > "$output_file"
            else
                error "tshark is required for JSON conversion. Install wireshark-common package."
            fi
            ;;
        "csv")
            if command -v tshark > /dev/null 2>&1; then
                tshark -r "$input_file" -T fields -e frame.number -e frame.time_relative -e ip.src -e ip.dst -e tcp.srcport -e tcp.dstport -E separator=',' > "$output_file"
            else
                error "tshark is required for CSV conversion. Install wireshark-common package."
            fi
            ;;
        *)
            error "Unsupported format: $format. Supported formats: txt, json, csv"
            ;;
    esac

    log "Conversion completed: $output_file"
}

# Delete old capture files
cleanup_captures() {
    local days=${1:-7}

    log "Cleaning up capture files older than $days days"

    if [[ ! -d "$CAPTURES_DIR" ]]; then
        warn "Captures directory does not exist"
        return
    fi

    local deleted_files
    deleted_files=$(find "$CAPTURES_DIR" -name "*.pcap" -type f -mtime +$days -print 2>/dev/null | wc -l)

    if [[ "$deleted_files" -gt 0 ]]; then
        find "$CAPTURES_DIR" -name "*.pcap" -type f -mtime +$days -delete
        log "Deleted $deleted_files old capture files"
    else
        log "No old capture files to delete"
    fi
}

# Main function
main() {
    case "${1:-help}" in
        "start")
            check_root
            check_tcpdump
            setup_captures_dir

            if [[ $# -lt 3 ]]; then
                error "Usage: $0 start <interface> <output_file> [filter] [duration] [max_size]"
            fi

            local interface=$2
            local output_file=$3
            local filter=${4:-}
            local duration=${5:-0}
            local max_size=${6:-$MAX_CAPTURE_SIZE}

            check_interface "$interface"
            start_capture "$interface" "$output_file" "$filter" "$duration" "$max_size"
            ;;
        "stop")
            check_root
            if [[ $# -lt 2 ]]; then
                error "Usage: $0 stop <pid>"
            fi
            stop_capture "$2"
            ;;
        "sandbox")
            check_root
            check_tcpdump
            setup_captures_dir

            if [[ $# -lt 3 ]]; then
                error "Usage: $0 sandbox <instance_id> <command> [options...]"
            fi

            local instance_id=$2
            local command=$3
            shift 3

            local bridge_name
            bridge_name=$(get_bridge_interface "$instance_id")

            case "$command" in
                "start")
                    if [[ $# -lt 1 ]]; then
                        error "Usage: $0 sandbox <instance_id> start <filter> [duration]"
                    fi
                    local filter=$1
                    local duration=${2:-0}
                    local output_file
                    output_file=$(generate_capture_filename "$instance_id" "$filter")
                    start_capture "$bridge_name" "$output_file" "$filter" "$duration"
                    ;;
                *)
                    error "Unknown sandbox command: $command"
                    ;;
            esac
            ;;
        "list")
            list_captures
            ;;
        "files")
            list_capture_files
            ;;
        "analyze")
            if [[ $# -lt 2 ]]; then
                error "Usage: $0 analyze <capture_file> [analysis_type]"
            fi
            analyze_capture "$2" "${3:-summary}"
            ;;
        "convert")
            if [[ $# -lt 4 ]]; then
                error "Usage: $0 convert <input_file> <output_file> <format>"
            fi
            convert_capture "$2" "$3" "$4"
            ;;
        "cleanup")
            cleanup_captures "${2:-7}"
            ;;
        "help"|*)
            echo "Traffic Capture Tool for Android Sandbox"
            echo ""
            echo "Usage: $0 <command> [options]"
            echo ""
            echo "Commands:"
            echo "  start <interface> <output> [filter] [duration] [size]  Start capture"
            echo "  stop <pid>                                            Stop capture"
            echo "  sandbox <instance_id> <command> [options...]         Capture from sandbox"
            echo "  list                                                  List active captures"
            echo "  files                                                 List capture files"
            echo "  analyze <file> [type]                                Analyze capture"
            echo "  convert <input> <output> <format>                    Convert format"
            echo "  cleanup [days]                                       Clean old files"
            echo "  help                                                  Show this help"
            echo ""
            echo "Examples:"
            echo "  $0 start eth0 /tmp/capture.pcap \"tcp port 80\" 300"
            echo "  $0 sandbox sandbox001 start \"tcp port 443\" 600"
            echo "  $0 analyze /opt/captures/capture.pcap protocols"
            echo "  $0 convert capture.pcap capture.txt txt"
            echo "  $0 cleanup 30"
            ;;
    esac
}

# Run main function with all arguments
main "$@"