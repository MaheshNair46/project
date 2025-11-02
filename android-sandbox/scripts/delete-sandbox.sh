#!/bin/bash

# Delete Android Sandbox Script
# Safely deletes an Android sandbox instance with confirmation

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
Android Sandbox Deletion Script

Usage: $0 [OPTIONS] SANDBOX_ID

OPTIONS:
    -f, --force              Skip confirmation prompt
    -y, --yes                Auto-confirm deletion (non-interactive)
    -n, --name NAME          Delete sandbox by name instead of ID
    --dry-run                Show what would be deleted without actually deleting
    --backup-before-delete   Create backup before deletion
    --backup-dir DIR         Directory for backups (default: ./backups)
    --help                   Show this help message

ARGUMENTS:
    SANDBOX_ID              The ID of the sandbox to delete
    OR use -n/--name to specify by name

EXAMPLES:
    $0 sandbox-12345                           # Delete by ID with confirmation
    $0 -f sandbox-12345                        # Force delete without confirmation
    $0 -n "malware-analysis"                   # Delete by name
    $0 --dry-run sandbox-12345                 # Show what would be deleted
    $0 --backup-before-delete sandbox-12345    # Backup before deleting

SAFETY:
    - This script will stop the sandbox if it's running
    - Confirmation is required unless --force is used
    - Optional backup can be created before deletion
    - All associated data will be permanently removed
EOF
}

# Parse command line arguments
parse_arguments() {
    SANDBOX_ID=""
    SANDBOX_NAME=""
    FORCE_DELETE="false"
    AUTO_CONFIRM="false"
    DRY_RUN="false"
    BACKUP_BEFORE_DELETE="false"
    BACKUP_DIR="./backups"

    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--force)
                FORCE_DELETE="true"
                AUTO_CONFIRM="true"
                shift
                ;;
            -y|--yes)
                AUTO_CONFIRM="true"
                shift
                ;;
            -n|--name)
                SANDBOX_NAME="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN="true"
                shift
                ;;
            --backup-before-delete)
                BACKUP_BEFORE_DELETE="true"
                shift
                ;;
            --backup-dir)
                BACKUP_DIR="$2"
                shift 2
                ;;
            --help)
                show_usage
                exit 0
                ;;
            -*)
                error "Unknown option: $1"
                ;;
            *)
                if [[ -z "$SANDBOX_ID" ]]; then
                    SANDBOX_ID="$1"
                else
                    error "Multiple sandbox IDs specified"
                fi
                shift
                ;;
        esac
    done

    # Validate arguments
    if [[ -z "$SANDBOX_ID" && -z "$SANDBOX_NAME" ]]; then
        error "Sandbox ID or name must be specified"
    fi

    if [[ -n "$SANDBOX_ID" && -n "$SANDBOX_NAME" ]]; then
        error "Cannot specify both ID and name"
    fi

    # Create backup directory if needed
    if [[ "$BACKUP_BEFORE_DELETE" == "true" ]]; then
        mkdir -p "$BACKUP_DIR"
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

    if [[ "$BACKUP_BEFORE_DELETE" == "true" ]] && ! command -v tar > /dev/null 2>&1; then
        error "tar is required for backup functionality"
    fi

    log "Prerequisites check completed"
}

# Find sandbox by name
find_sandbox_by_name() {
    local name="$1"
    log "Searching for sandbox with name: $name"

    local response
    response=$(curl -s \
        -H "Authorization: Bearer $API_TOKEN" \
        "$API_BASE_URL/sandboxes?search=$name")

    if [[ $? -ne 0 ]]; then
        error "Failed to search for sandbox"
    fi

    if command -v jq > /dev/null 2>&1; then
        local sandbox_id
        sandbox_id=$(echo "$response" | jq -r ".data.sandboxes[] | select(.name == \"$name\") | .id")

        if [[ -n "$sandbox_id" && "$sandbox_id" != "null" ]]; then
            echo "$sandbox_id"
        else
            error "No sandbox found with name: $name"
        fi
    else
        error "jq is required to search by name"
    fi
}

# Get sandbox information
get_sandbox_info() {
    local sandbox_id="$1"

    local response
    response=$(curl -s \
        -H "Authorization: Bearer $API_TOKEN" \
        "$API_BASE_URL/sandboxes/$sandbox_id")

    if [[ $? -ne 0 ]]; then
        error "Failed to get sandbox information"
    fi

    echo "$response"
}

# Stop sandbox if running
stop_sandbox() {
    local sandbox_id="$1"
    local sandbox_info="$2"

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would stop sandbox if running"
        return
    fi

    local status
    if command -v jq > /dev/null 2>&1; then
        status=$(echo "$sandbox_info" | jq -r '.data.status')
    else
        warn "Cannot determine sandbox status without jq"
        return
    fi

    if [[ "$status" == "running" ]]; then
        log "Stopping sandbox..."
        local response
        response=$(curl -s -w "\n%{http_code}" \
            -X POST \
            -H "Authorization: Bearer $API_TOKEN" \
            "$API_BASE_URL/sandboxes/$sandbox_id/stop")

        local http_code=$(echo "$response" | tail -n1)
        local response_body=$(echo "$response" | head -n -1)

        if [[ "$http_code" -eq 200 ]]; then
            log "Sandbox stopped successfully"
        else
            warn "Failed to stop sandbox: $response_body"
            if [[ "$FORCE_DELETE" != "true" ]]; then
                error "Cannot proceed with deletion while sandbox is running. Use --force to override."
            fi
        fi
    else
        log "Sandbox is not running (status: $status)"
    fi
}

# Create backup of sandbox data
create_backup() {
    local sandbox_id="$1"
    local sandbox_info="$2"
    local backup_file="$BACKUP_DIR/sandbox-${sandbox_id}-$(date +%Y%m%d-%H%M%S).tar.gz"

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would create backup: $backup_file"
        return
    fi

    log "Creating backup of sandbox data..."

    # Extract sandbox details
    local sandbox_name
    local android_version
    local device_profile
    local security_policy
    local analysis_tools
    local tags

    if command -v jq > /dev/null 2>&1; then
        sandbox_name=$(echo "$sandbox_info" | jq -r '.data.name')
        android_version=$(echo "$sandbox_info" | jq -r '.data.android_version')
        device_profile=$(echo "$sandbox_info" | jq -r '.data.device_profile')
        security_policy=$(echo "$sandbox_info" | jq -r '.data.security_policy')
        analysis_tools=$(echo "$sandbox_info" | jq -r '.data.analysis_tools | join(",")')
        tags=$(echo "$sandbox_info" | jq -r '.data.tags | join(",")')
    else
        warn "Cannot extract full sandbox details without jq"
        sandbox_name="$sandbox_id"
    fi

    # Create backup metadata
    local metadata_file="/tmp/sandbox-${sandbox_id}-metadata.json"
    cat > "$metadata_file" << EOF
{
    "sandbox_id": "$sandbox_id",
    "name": "$sandbox_name",
    "android_version": "$android_version",
    "device_profile": "$device_profile",
    "security_policy": "$security_policy",
    "analysis_tools": "$analysis_tools",
    "tags": "$tags",
    "backup_date": "$(date -Iseconds)",
    "deleted_by": "$(whoami)"
}
EOF

    # Create backup archive
    local temp_dir="/tmp/sandbox-backup-${sandbox_id}"
    mkdir -p "$temp_dir"
    cp "$metadata_file" "$temp_dir/metadata.json"

    # Get logs and other data if possible
    local logs_file
    logs_file=$(curl -s \
        -H "Authorization: Bearer $API_TOKEN" \
        "$API_BASE_URL/sandboxes/$sandbox_id/logs" \
        > "$temp_dir/logs.txt" 2>/dev/null && echo "$temp_dir/logs.txt" || true)

    # Create archive
    tar -czf "$backup_file" -C "$temp_dir" . 2>/dev/null || warn "Failed to create backup archive"

    # Cleanup
    rm -rf "$temp_dir" "$metadata_file"

    if [[ -f "$backup_file" ]]; then
        log "Backup created: $backup_file"
    else
        warn "Failed to create backup"
    fi
}

# Delete sandbox
delete_sandbox() {
    local sandbox_id="$1"

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would delete sandbox: $sandbox_id"
        return
    fi

    log "Deleting sandbox: $sandbox_id"

    local response
    response=$(curl -s -w "\n%{http_code}" \
        -X DELETE \
        -H "Authorization: Bearer $API_TOKEN" \
        "$API_BASE_URL/sandboxes/$sandbox_id")

    local http_code=$(echo "$response" | tail -n1)
    local response_body=$(echo "$response" | head -n -1)

    if [[ "$http_code" -eq 200 ]]; then
        log "Sandbox deleted successfully"
        return
    else
        error "Failed to delete sandbox. HTTP $http_code: $response_body"
    fi
}

# Show sandbox information
show_sandbox_info() {
    local sandbox_info="$1"

    if command -v jq > /dev/null 2>&1; then
        local name
        local status
        local android_version
        local device_profile
        local ip_address
        local created_at

        name=$(echo "$sandbox_info" | jq -r '.data.name')
        status=$(echo "$sandbox_info" | jq -r '.data.status')
        android_version=$(echo "$sandbox_info" | jq -r '.data.android_version')
        device_profile=$(echo "$sandbox_info" | jq -r '.data.device_profile')
        ip_address=$(echo "$sandbox_info" | jq -r '.data.ip_address // "N/A"')
        created_at=$(echo "$sandbox_info" | jq -r '.data.created_at')

        echo ""
        echo "=== Sandbox Information ==="
        echo "Name: $name"
        echo "ID: $SANDBOX_ID"
        echo "Status: $status"
        echo "Android Version: $android_version"
        echo "Device Profile: $device_profile"
        echo "IP Address: $ip_address"
        echo "Created: $created_at"
        echo "============================"
    else
        echo ""
        echo "=== Sandbox Information ==="
        echo "ID: $SANDBOX_ID"
        echo "Status: Unknown (jq not available)"
        echo "============================"
    fi
}

# Confirm deletion
confirm_deletion() {
    if [[ "$AUTO_CONFIRM" == "true" ]]; then
        return
    fi

    echo ""
    warn "WARNING: This will permanently delete the sandbox and all associated data!"
    warn "This action cannot be undone."

    echo ""
    read -p "Are you sure you want to delete this sandbox? [y/N]: " -n 1 -r
    echo ""

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Deletion cancelled by user"
        exit 0
    fi
}

# Main function
main() {
    parse_arguments "$@"
    check_prerequisites

    # Find sandbox by name if specified
    if [[ -n "$SANDBOX_NAME" ]]; then
        SANDBOX_ID=$(find_sandbox_by_name "$SANDBOX_NAME")
        log "Found sandbox ID: $SANDBOX_ID"
    fi

    # Get sandbox information
    local sandbox_info
    sandbox_info=$(get_sandbox_info "$SANDBOX_ID")

    # Show sandbox information
    show_sandbox_info "$sandbox_info"

    # Create backup if requested
    if [[ "$BACKUP_BEFORE_DELETE" == "true" ]]; then
        create_backup "$SANDBOX_ID" "$sandbox_info"
    fi

    # Confirm deletion
    if [[ "$FORCE_DELETE" != "true" && "$DRY_RUN" != "true" ]]; then
        confirm_deletion
    fi

    # Stop sandbox if running
    stop_sandbox "$SANDBOX_ID" "$sandbox_info"

    # Delete sandbox
    delete_sandbox "$SANDBOX_ID"

    if [[ "$DRY_RUN" != "true" ]]; then
        log "Sandbox deletion completed successfully"
    else
        log "DRY RUN: Deletion would be completed here"
    fi
}

# Run main function with all arguments
main "$@"