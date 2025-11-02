#!/bin/bash

# Android Sandbox System Validation Script
# Validates that all required components are in place and properly configured

set -e

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
}

# Validation results
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# Validation function
validate() {
    local check_name="$1"
    local check_command="$2"

    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

    echo -n "Checking $check_name... "

    if eval "$check_command" > /dev/null 2>&1; then
        echo -e "${GREEN}PASS${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
}

# Warning validation (doesn't count as failure)
validate_warning() {
    local check_name="$1"
    local check_command="$2"

    echo -n "Checking $check_name... "

    if eval "$check_command" > /dev/null 2>&1; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${YELLOW}WARNING${NC}"
    fi
}

echo "Android Sandbox System Validation"
echo "================================="
echo

# Validate directory structure
validate "Root directory structure" "[ -d config -a -d dashboard -a -d docs -a -d network -a -d scripts -a -d tools ]"
validate "Config subdirectories" "[ -d config/device-templates -a -d config/network-profiles -a -d config/security-policies ]"
validate "Dashboard structure" "[ -d dashboard/src -a -d dashboard/server -a -f dashboard/package.json -a -f dashboard/Dockerfile ]"
validate "Server structure" "[ -d dashboard/server/routes -a -d dashboard/server/models -a -d dashboard/server/middleware -a -d dashboard/server/services ]"
validate "Tools structure" "[ -d tools/frida-scripts -a -d tools/tcpdump-filters -a -d tools/analysis-templates ]"

# Validate core files
validate "Docker Compose file" "[ -f docker-compose.yml ]"
validate "Main Dockerfile" "[ -f Dockerfile ]"
validate "Package.json files" "[ -f dashboard/package.json -a -f dashboard/server/package.json ]"
validate "Server entry point" "[ -f dashboard/server/server.js ]"
validate "Health check script" "[ -f dashboard/server/healthcheck.js ]"

# Validate configuration files
validate "Device templates" "[ -f config/device-templates/pixel-5.yml -a -f config/device-templates/samsung-s21.yml ]"
validate "Network profiles" "[ -f config/network-profiles/standard.yml -f f config/network-profiles/restricted.yml ]"
validate "Security policies" "[ -f config/security-policies/analysis-mode.yml -a -f config/security-policies/stealth-mode.yml ]"

# Validate network scripts
validate "Network management scripts" "[ -f network/setup-networks.sh -a -f network/simulate-conditions.sh -a -f network/capture-traffic.sh ]"
validate "Script executability" "[ -x network/*.sh ]"

# Validate management scripts
validate "Sandbox management scripts" "[ -f scripts/create-sandbox.sh -a -f scripts/list-sandboxes.sh -a -f scripts/delete-sandbox.sh ]"
validate "Management scripts executability" "[ -x scripts/*.sh ]"

# Validate analysis tools
validate "Frida scripts" "[ -f tools/frida-scripts/ssl-unpinning.js -a -f tools/frida-scripts/network-monitoring.js -a -f tools/frida-scripts/crypto-hooks.js ]"
validate "TCPDump filters" "[ -f tools/tcpdump-filters/http-https.txt -a -f tools/tcpdump-filters/malware-c2.txt ]"

# Validate backend files
validate "API routes" "[ -f dashboard/server/routes/auth.js -a -f dashboard/server/routes/sandboxes.js -a -f dashboard/server/routes/monitoring.js ]"
validate "Middleware files" "[ -f dashboard/server/middleware/auth.js -a -f dashboard/server/middleware/permissions.js ]"
validate "Database files" "[ -f dashboard/server/database/index.js -a -f dashboard/server/init.sql ]"
validate "Service files" "[ -f dashboard/server/services/docker.js ]"
validate "Model files" "[ -f dashboard/server/models/Sandbox.js ]"

# Validate frontend files
validate "Frontend entry point" "[ -f dashboard/src/App.js ]"
validate "Frontend pages" "[ -f dashboard/src/pages/Sandboxes.js -a -f dashboard/src/pages/CreateSandbox.js ]"

# Validate documentation
validate "Main documentation" "[ -f docs/README.md -a -f docs/DEPLOYMENT.md -a -f docs/API.md ]"

# Validate file contents (basic syntax checks)
echo "Validating file contents..."

validate "Docker Compose syntax" "docker-compose -f docker-compose.yml config > /dev/null"
validate "Node.js package.json syntax" "node -e 'JSON.parse(require(\"fs\").readFileSync(\"dashboard/package.json\"))' > /dev/null"
validate "Server package.json syntax" "node -e 'JSON.parse(require(\"fs\").readFileSync(\"dashboard/server/package.json\"))' > /dev/null"
validate "Server JavaScript syntax" "node -c dashboard/server/server.js"
validate "Health check syntax" "node -c dashboard/server/healthcheck.js"

# Optional validations (warnings)
echo
echo "Optional checks:"

validate_warning "React frontend files" "[ -f dashboard/src/index.js -o -f dashboard/public/index.html ]"
validate_warning "Environment file template" "[ -f .env.example ]"
validate_warning "Git repository" "[ -d .git ]"
validate_warning "License file" "[ -f LICENSE ]"

# Summary
echo
echo "=========================================="
echo "VALIDATION SUMMARY"
echo "=========================================="
echo "Total checks: $TOTAL_CHECKS"
echo -e "Passed: ${GREEN}$PASSED_CHECKS${NC}"
echo -e "Failed: ${RED}$FAILED_CHECKS${NC}"

if [ $FAILED_CHECKS -eq 0 ]; then
    echo
    echo -e "${GREEN}✅ All validation checks passed!${NC}"
    echo "The Android Sandbox system is properly structured and ready for deployment."
    exit 0
else
    echo
    echo -e "${RED}❌ $FAILED_CHECKS validation check(s) failed${NC}"
    echo "Please address the failed checks before proceeding with deployment."
    exit 1
fi