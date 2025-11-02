#!/bin/bash

# List Android Sandboxes Script
# Lists all Android sandbox instances with their status and details

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_BASE_URL="http://localhost:3000/api/v1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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
Android Sandbox List Script

Usage: $0 [OPTIONS]

OPTIONS:
    -s, --status STATUS      Filter by status (running, stopped, failed, starting)
    -n, --name NAME          Filter by name (partial match)
    -t, --tags TAGS          Filter by tags (comma-separated)
    -f, --format FORMAT      Output format (table, json, csv) [default: table]
    -o, --output FILE        Output to file instead of stdout
    -l, --limit LIMIT        Limit number of results [default: 50]
    --detailed              Show detailed information
    --refresh               Refresh cache before listing
    --help                  Show this help message

FILTERS:
    STATUS: running, stopped, failed, starting, creating
    NAME:  Partial name match (case-insensitive)
    TAGS:  Comma-separated list of tags to match

EXAMPLES:
    $0                                    # List all sandboxes
    $0 --status running                   # List only running sandboxes
    $0 --name malware --detailed          # Show detailed info for sandboxes with 'malware' in name
    $0 --format json --output sandboxes.json  # Export to JSON file
    $0 --tags "malware,analysis"          # List sandboxes with specific tags
EOF
}

# Parse command line arguments
parse_arguments() {
    STATUS_FILTER=""
    NAME_FILTER=""
    TAGS_FILTER=""
    FORMAT="table"
    OUTPUT_FILE=""
    LIMIT="50"
    DETAILED="false"
    REFRESH="false"

    while [[ $# -gt 0 ]]; do
        case $1 in
            -s|--status)
                STATUS_FILTER="$2"
                shift 2
                ;;
            -n|--name)
                NAME_FILTER="$2"
                shift 2
                ;;
            -t|--tags)
                TAGS_FILTER="$2"
                shift 2
                ;;
            -f|--format)
                FORMAT="$2"
                shift 2
                ;;
            -o|--output)
                OUTPUT_FILE="$2"
                shift 2
                ;;
            -l|--limit)
                LIMIT="$2"
                shift 2
                ;;
            --detailed)
                DETAILED="true"
                shift
                ;;
            --refresh)
                REFRESH="true"
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

    # Validate format
    if [[ ! "$FORMAT" =~ ^(table|json|csv)$ ]]; then
        error "Invalid format: $FORMAT. Must be table, json, or csv"
    fi

    # Validate limit
    if [[ ! "$LIMIT" =~ ^[0-9]+$ ]] || [[ "$LIMIT" -lt 1 ]] || [[ "$LIMIT" -gt 1000 ]]; then
        error "Invalid limit: $LIMIT. Must be between 1 and 1000"
    fi
}

# Check prerequisites
check_prerequisites() {
    # Check if API server is running
    if ! curl -s "$API_BASE_URL/health" > /dev/null 2>&1; then
        error "API server is not running. Please start it with: docker-compose up -d"
    fi

    # Check required tools
    if ! command -v curl > /dev/null 2>&1; then
        error "curl is required but not installed"
    fi

    if [[ "$DETAILED" == "true" ]] && ! command -v jq > /dev/null 2>&1; then
        warn "jq is not installed. Detailed output may be limited."
    fi

    log "Prerequisites check completed"
}

# Fetch sandboxes from API
fetch_sandboxes() {
    log "Fetching sandbox list..."

    local api_url="$API_BASE_URL/sandboxes"
    local params=()

    # Add query parameters
    if [[ -n "$STATUS_FILTER" ]]; then
        params+=("status=$STATUS_FILTER")
    fi
    if [[ -n "$NAME_FILTER" ]]; then
        params+=("search=$NAME_FILTER")
    fi
    if [[ -n "$LIMIT" ]]; then
        params+=("limit=$LIMIT")
    fi

    # Build URL with parameters
    if [[ ${#params[@]} -gt 0 ]]; then
        api_url="$api_url?$(IFS='&'; echo "${params[*]}")"
    fi

    debug "API URL: $api_url"

    # Make API request
    local response
    response=$(curl -s \
        -H "Authorization: Bearer $API_TOKEN" \
        "$api_url")

    if [[ $? -ne 0 ]]; then
        error "Failed to fetch sandboxes from API"
    fi

    echo "$response"
}

# Format duration in human-readable format
format_duration() {
    local duration=$1
    if [[ -z "$duration" || "$duration" == "null" ]]; then
        echo "N/A"
        return
    fi

    local hours=$((duration / 3600))
    local minutes=$(( (duration % 3600) / 60 ))
    local seconds=$((duration % 60))

    if [[ $hours -gt 0 ]]; then
        printf "%dh %dm %ds" $hours $minutes $seconds
    elif [[ $minutes -gt 0 ]]; then
        printf "%dm %ds" $minutes $seconds
    else
        printf "%ds" $seconds
    fi
}

# Format file size in human-readable format
format_size() {
    local size=$1
    if [[ -z "$size" || "$size" == "null" ]]; then
        echo "N/A"
        return
    fi

    if [[ $size -gt 1073741824 ]]; then
        printf "%.1fGB" $(echo "$size / 1073741824" | bc -l)
    elif [[ $size -gt 1048576 ]]; then
        printf "%.1fMB" $(echo "$size / 1048576" | bc -l)
    elif [[ $size -gt 1024 ]]; then
        printf "%.1fKB" $(echo "$size / 1024" | bc -l)
    else
        printf "%dB" $size
    fi
}

# Filter sandboxes by tags
filter_by_tags() {
    local sandboxes_json="$1"
    local tags_filter="$2"

    if [[ -z "$tags_filter" ]]; then
        echo "$sandboxes_json"
        return
    fi

    # Convert tags filter to array
    IFS=',' read -ra TAGS_ARRAY <<< "$tags_filter"

    # Filter using jq
    if command -v jq > /dev/null 2>&1; then
        echo "$sandboxes_json" | jq --argjson tags "$(printf '%s\n' "${TAGS_ARRAY[@]}" | jq -R . | jq -s .)" '
            .data.sandboxes |= map(
                select(
                    (.tags // []) as $sandbox_tags |
                    any($tags[]; IN($sandbox_tags[]))
                )
            )
        '
    else
        # Fallback: simple grep-based filtering (less accurate)
        echo "$sandboxes_json"
    fi
}

# Output in table format
output_table() {
    local sandboxes_json="$1"
    local detailed="$2"

    if [[ "$detailed" == "true" ]]; then
        output_detailed_table "$sandboxes_json"
    else
        output_basic_table "$sandboxes_json"
    fi
}

# Output basic table
output_basic_table() {
    local sandboxes_json="$1"

    if command -v jq > /dev/null 2>&1; then
        # Use jq for proper JSON parsing
        echo "$sandboxes_json" | jq -r '
            .data.sandboxes[] | [
                .name[0:30],
                .status,
                .android_version,
                .device_profile,
                (.ip_address // "N/A"),
                (.adb_port // "N/A"),
                (.vnc_port // "N/A"),
                (.created_at[0:19])
            ] | @tsv
        ' | while IFS=$'\t' read -r name status version device ip adb vnc created; do
            # Format status with color
            case $status in
                "running")
                    status_colored="${GREEN}$status${NC}"
                    ;;
                "stopped")
                    status_colored="${YELLOW}$status${NC}"
                    ;;
                "failed")
                    status_colored="${RED}$status${NC}"
                    ;;
                "starting")
                    status_colored="${BLUE}$status${NC}"
                    ;;
                *)
                    status_colored="$status"
                    ;;
            esac

            printf "%-30s %-12s %-8s %-12s %-15s %-8s %-8s %s\n" \
                "$name" "$status_colored" "$version" "$device" "$ip" "$adb" "$vnc" "$created"
        done
    else
        warn "jq not available. Showing raw JSON output."
        echo "$sandboxes_json"
    fi
}

# Output detailed table
output_detailed_table() {
    local sandboxes_json="$1"

    if command -v jq > /dev/null 2>&1; then
        local sandboxes_count=$(echo "$sandboxes_json" | jq '.data.sandboxes | length')

        echo "$sandboxes_json" | jq -r '
            .data.sandboxes[] |
            "Sandbox: \(.name)",
            "ID: \(.id)",
            "Status: \(.status)",
            "Android Version: \(.android_version)",
            "Device Profile: \(.device_profile)",
            "Security Policy: \(.security_policy)",
            "IP Address: \(.ip_address // "N/A")",
            "ADB Port: \(.adb_port // "N/A")",
            "VNC Port: \(.vnc_port // "N/A")",
            "RAM: \(.ram_mb // "N/A")MB",
            "CPU Limit: \(.cpu_limit // "N/A")%",
            "Analysis Tools: \(.analysis_tools // [] | join(", "))",
            "Tags: \(.tags // [] | join(", "))",
            "Created: \(.created_at)",
            "Started: \(.started_at // "N/A")",
            "Stopped: \(.stopped_at // "N/A")",
            "Error: \(.error_message // "None")",
            "---"
        ' | while IFS= read -r line; do
            echo "$line"
        done
    else
        warn "jq not available. Showing raw JSON output."
        echo "$sandboxes_json"
    fi
}

# Output in JSON format
output_json() {
    local sandboxes_json="$1"

    if [[ "$OUTPUT_FILE" ]]; then
        echo "$sandboxes_json" > "$OUTPUT_FILE"
        log "JSON output saved to: $OUTPUT_FILE"
    else
        echo "$sandboxes_json"
    fi
}

# Output in CSV format
output_csv() {
    local sandboxes_json="$1"

    local csv_header="name,status,android_version,device_profile,ip_address,adb_port,vnc_port,security_policy,analysis_tools,tags,created_at"

    if [[ "$OUTPUT_FILE" ]]; then
        echo "$csv_header" > "$OUTPUT_FILE"
        if command -v jq > /dev/null 2>&1; then
            echo "$sandboxes_json" | jq -r '
                .data.sandboxes[] | [
                    .name,
                    .status,
                    .android_version,
                    .device_profile,
                    (.ip_address // ""),
                    (.adb_port // ""),
                    (.vnc_port // ""),
                    .security_policy,
                    (.analysis_tools // [] | join(";")),
                    (.tags // [] | join(";")),
                    .created_at
                ] | @csv
            ' >> "$OUTPUT_FILE"
        else
            warn "jq not available. Cannot generate CSV output."
        fi
        log "CSV output saved to: $OUTPUT_FILE"
    else
        echo "$csv_header"
        if command -v jq > /dev/null 2>&1; then
            echo "$sandboxes_json" | jq -r '
                .data.sandboxes[] | [
                    .name,
                    .status,
                    .android_version,
                    .device_profile,
                    (.ip_address // ""),
                    (.adb_port // ""),
                    (.vnc_port // ""),
                    .security_policy,
                    (.analysis_tools // [] | join(";")),
                    (.tags // [] | join(";")),
                    .created_at
                ] | @csv
            '
        else
            warn "jq not available. Cannot generate CSV output."
        fi
    fi
}

# Show statistics
show_statistics() {
    local sandboxes_json="$1"

    if command -v jq > /dev/null 2>&1; then
        echo ""
        echo "=== Statistics ==="
        local total=$(echo "$sandboxes_json" | jq '.data.sandboxes | length')
        local running=$(echo "$sandboxes_json" | jq '.data.sandboxes | map(select(.status == "running")) | length')
        local stopped=$(echo "$sandboxes_json" | jq '.data.sandboxes | map(select(.status == "stopped")) | length')
        local failed=$(echo "$sandboxes_json" | jq '.data.sandboxes | map(select(.status == "failed")) | length')
        local starting=$(echo "$sandboxes_json" | jq '.data.sandboxes | map(select(.status == "starting")) | length')

        echo "Total: $total"
        echo -e "Running: ${GREEN}$running${NC}"
        echo -e "Stopped: ${YELLOW}$stopped${NC}"
        echo -e "Failed: ${RED}$failed${NC}"
        echo -e "Starting: ${BLUE}$starting${NC}"
        echo "================="
    fi
}

# Main function
main() {
    parse_arguments "$@"
    check_prerequisites

    # Fetch sandboxes
    local sandboxes_json
    sandboxes_json=$(fetch_sandboxes)

    if [[ -z "$sandboxes_json" ]]; then
        error "No sandbox data received from API"
    fi

    # Filter by tags if specified
    if [[ -n "$TAGS_FILTER" ]]; then
        sandboxes_json=$(filter_by_tags "$sandboxes_json" "$TAGS_FILTER")
    fi

    # Show table header
    if [[ "$FORMAT" == "table" && "$DETAILED" != "true" ]]; then
        echo ""
        printf "%-30s %-12s %-8s %-12s %-15s %-8s %-8s %s\n" \
            "NAME" "STATUS" "ANDROID" "DEVICE" "IP_ADDRESS" "ADB" "VNC" "CREATED"
        printf "%-30s %-12s %-8s %-12s %-15s %-8s %-8s %s\n" \
            "------------------------------" "------------" "--------" "------------" "---------------" "--------" "--------" "-------------------"
    fi

    # Output in requested format
    case "$FORMAT" in
        "table")
            output_table "$sandboxes_json" "$DETAILED"
            ;;
        "json")
            output_json "$sandboxes_json"
            ;;
        "csv")
            output_csv "$sandboxes_json"
            ;;
    esac

    # Show statistics for table format
    if [[ "$FORMAT" == "table" ]]; then
        show_statistics "$sandboxes_json"
    fi
}

# Run main function with all arguments
main "$@"