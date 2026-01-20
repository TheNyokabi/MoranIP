#!/bin/bash
# End-to-End Test Helper Functions
# Provides utilities for token management, response validation, and data extraction

# Source configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/test_e2e_config.sh"

# ==================== Logging Functions ====================
log_info() {
    echo "[INFO] $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "${TEST_LOG_FILE}"
}

log_error() {
    echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "${TEST_LOG_FILE}"
    echo "$1" >&2
}

log_success() {
    echo "[SUCCESS] $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "${TEST_LOG_FILE}"
}

log_test_phase() {
    local phase="$1"
    local status="${2:-start}"
    if [ "$status" = "start" ]; then
        echo "" | tee -a "${TEST_LOG_FILE}"
        echo "========================================" | tee -a "${TEST_LOG_FILE}"
        echo "Phase: $phase - START" | tee -a "${TEST_LOG_FILE}"
        echo "========================================" | tee -a "${TEST_LOG_FILE}"
    else
        echo "Phase: $phase - END ($status)" | tee -a "${TEST_LOG_FILE}"
        echo "========================================" | tee -a "${TEST_LOG_FILE}"
    fi
}

# ==================== Token Management ====================
store_token() {
    local token="$1"
    local token_type="${2:-access_token}"
    echo "$token" > "${TOKEN_FILE}.${token_type}"
    chmod 600 "${TOKEN_FILE}.${token_type}"
}

load_token() {
    local token_type="${1:-access_token}"
    if [ -f "${TOKEN_FILE}.${token_type}" ]; then
        cat "${TOKEN_FILE}.${token_type}"
    else
        echo ""
    fi
}

get_auth_header() {
    local token=$(load_token)
    if [ -n "$token" ]; then
        echo "Authorization: Bearer $token"
    else
        echo ""
    fi
}

clear_tokens() {
    rm -f "${TOKEN_FILE}".*
}

# ==================== HTTP Request Functions ====================
make_request() {
    local method="$1"
    local endpoint="$2"
    local data="${3:-}"
    local token="${4:-$(load_token)}"
    local timeout="${5:-${TEST_TIMEOUT}}"
    
    local url="${API_BASE}${endpoint}"
    local headers=()
    
    if [ -n "$token" ]; then
        headers+=("-H" "Authorization: Bearer $token")
    fi
    
    if [ -n "$data" ]; then
        headers+=("-H" "Content-Type: application/json")
    fi
    
    local response_file=$(mktemp)
    local http_code=$(curl -s -w "%{http_code}" \
        -X "$method" \
        "${headers[@]}" \
        ${data:+-d "$data"} \
        --max-time "$timeout" \
        -o "$response_file" \
        "$url")
    
    local response_body=$(cat "$response_file")
    rm -f "$response_file"
    
    echo "$http_code|$response_body"
}

# Make request with custom base URL (for IAM endpoints mounted at root)
make_request_with_base() {
    local method="$1"
    local endpoint="$2"
    local data="${3:-}"
    local token="${4:-$(load_token)}"
    local base_url="${5:-${BASE_URL}}"
    local timeout="${6:-${TEST_TIMEOUT}}"
    
    local url="${base_url}${endpoint}"
    local headers=()
    
    if [ -n "$token" ]; then
        headers+=("-H" "Authorization: Bearer $token")
    fi
    
    if [ -n "$data" ]; then
        headers+=("-H" "Content-Type: application/json")
    fi
    
    local response_file=$(mktemp)
    local http_code=$(curl -s -w "%{http_code}" \
        -X "$method" \
        "${headers[@]}" \
        ${data:+-d "$data"} \
        --max-time "$timeout" \
        -o "$response_file" \
        "$url")
    
    local response_body=$(cat "$response_file")
    rm -f "$response_file"
    
    echo "$http_code|$response_body"
}

# ==================== Response Validation ====================
check_status() {
    local response="$1"
    local expected_status="${2:-200}"
    local http_code=$(echo "$response" | cut -d'|' -f1)
    
    if [ "$http_code" -eq "$expected_status" ]; then
        return 0
    else
        return 1
    fi
}

extract_field() {
    local response="$1"
    local field="$2"
    local response_body=$(echo "$response" | cut -d'|' -f2-)
    
    echo "$response_body" | jq -r ".${field}" 2>/dev/null || echo ""
}

extract_array_field() {
    local response="$1"
    local array_path="$2"
    local index="${3:-0}"
    local field="$4"
    local response_body=$(echo "$response" | cut -d'|' -f2-)
    
    echo "$response_body" | jq -r ".${array_path}[${index}].${field}" 2>/dev/null || echo ""
}

get_http_code() {
    local response="$1"
    echo "$response" | cut -d'|' -f1
}

get_response_body() {
    local response="$1"
    echo "$response" | cut -d'|' -f2-
}

# ==================== Assertion Functions ====================
assert_equals() {
    local actual="$1"
    local expected="$2"
    local message="${3:-Values should be equal}"
    
    if [ "$actual" = "$expected" ]; then
        log_success "Assertion passed: $message (expected: $expected, actual: $actual)"
        return 0
    else
        log_error "Assertion failed: $message (expected: $expected, actual: $actual)"
        return 1
    fi
}

assert_not_null() {
    local value="$1"
    local message="${2:-Value should not be null}"
    
    if [ -n "$value" ] && [ "$value" != "null" ] && [ "$value" != "" ]; then
        log_success "Assertion passed: $message"
        return 0
    else
        log_error "Assertion failed: $message (value is null or empty)"
        return 1
    fi
}

assert_contains() {
    local text="$1"
    local substring="$2"
    local message="${3:-Text should contain substring}"
    
    if echo "$text" | grep -q "$substring"; then
        log_success "Assertion passed: $message"
        return 0
    else
        log_error "Assertion failed: $message (text does not contain: $substring)"
        return 1
    fi
}

assert_status_code() {
    local response="$1"
    local expected_status="$2"
    local message="${3:-HTTP status code check}"
    
    local http_code=$(get_http_code "$response")
    if check_status "$response" "$expected_status"; then
        log_success "$message (status: $http_code)"
        return 0
    else
        local body=$(get_response_body "$response")
        log_error "$message (expected: $expected_status, got: $http_code)"
        log_error "Response body: $body"
        return 1
    fi
}

# ==================== Data Extraction Functions ====================
get_tenant_id() {
    local response="$1"
    extract_field "$response" "tenant.id"
}

get_user_id() {
    local response="$1"
    extract_field "$response" "user.id"
}

get_invoice_id() {
    local response="$1"
    local value
    value=$(extract_field "$response" "invoice.name")
    if [ -n "$value" ] && [ "$value" != "null" ]; then
        echo "$value"
        return
    fi
    value=$(extract_field "$response" "data.name")
    if [ -n "$value" ] && [ "$value" != "null" ]; then
        echo "$value"
        return
    fi
    value=$(extract_field "$response" "data.data.name")
    if [ -n "$value" ] && [ "$value" != "null" ]; then
        echo "$value"
        return
    fi
    extract_field "$response" "name"
}

get_invoice_name() {
    local response="$1"
    local value
    value=$(extract_field "$response" "invoice.name")
    if [ -n "$value" ] && [ "$value" != "null" ]; then
        echo "$value"
        return
    fi
    value=$(extract_field "$response" "data.name")
    if [ -n "$value" ] && [ "$value" != "null" ]; then
        echo "$value"
        return
    fi
    value=$(extract_field "$response" "data.data.name")
    if [ -n "$value" ] && [ "$value" != "null" ]; then
        echo "$value"
        return
    fi
    extract_field "$response" "name"
}

get_warehouse_name() {
    local response="$1"
    extract_field "$response" "warehouse.name" || extract_field "$response" "data.name" || extract_field "$response" "name"
}

get_item_code() {
    local response="$1"
    extract_field "$response" "item.item_code" || extract_field "$response" "data.item_code" || extract_field "$response" "data.name" || extract_field "$response" "item_code" || extract_field "$response" "name"
}

get_profile_id() {
    local response="$1"
    extract_field "$response" "profile.name" || extract_field "$response" "data.name" || extract_field "$response" "name"
}

# ==================== JSON Helper Functions ====================
json_escape() {
    echo "$1" | jq -Rs .
}

json_build_object() {
    local key="$1"
    local value="$2"
    echo "{\"${key}\": ${value}}"
}

json_build_array() {
    local items=("$@")
    printf '%s\n' "${items[@]}" | jq -s .
}

# ==================== Retry Functions ====================
retry_request() {
    local method="$1"
    local endpoint="$2"
    local data="${3:-}"
    local token="${4:-$(load_token)}"
    local max_retries="${5:-${MAX_RETRIES}}"
    local expected_status="${6:-200}"
    
    local attempt=1
    local response=""
    
    while [ $attempt -le $max_retries ]; do
        log_info "Attempt $attempt/$max_retries: $method $endpoint"
        response=$(make_request "$method" "$endpoint" "$data" "$token")
        
        if check_status "$response" "$expected_status"; then
            return 0
        fi
        
        local http_code=$(get_http_code "$response")
        if [ "$http_code" -ge 400 ] && [ "$http_code" -lt 500 ]; then
            # Client errors shouldn't be retried
            log_error "Client error ($http_code), not retrying"
            return 1
        fi
        
        attempt=$((attempt + 1))
        if [ $attempt -le $max_retries ]; then
            sleep $((attempt * 2))  # Exponential backoff
        fi
    done
    
    log_error "Request failed after $max_retries attempts"
    return 1
}

# ==================== Wait Functions ====================
wait_for_provisioning() {
    local tenant_id="$1"
    local max_wait="${PROVISIONING_WAIT_TIME}"
    local check_interval=10
    local elapsed=0
    local start_attempted=false
    
    log_info "Waiting for provisioning to complete (max ${max_wait}s)..."
    
    while [ $elapsed -lt $max_wait ]; do
        local response=$(make_request "GET" "/provisioning/tenants/${tenant_id}/status" "" "$ADMIN_TOKEN")
        local http_code=$(get_http_code "$response")
        local status_raw=$(extract_field "$response" "status")
        local status=$(echo "$status_raw" | tr '[:lower:]' '[:upper:]')
        
        if [ "$http_code" -ge 400 ]; then
            log_info "Provisioning status check returned HTTP $http_code: $(get_response_body "$response")"
        fi
        
        if [ "$status" = "NOT_STARTED" ] && [ "$start_attempted" = false ]; then
            log_info "Provisioning not started yet. Attempting to start..."
            local start_payload='{"include_demo_data":false,"pos_store_enabled":true}'
            local start_response=$(make_request "POST" "/provisioning/tenants/${tenant_id}/start" "$start_payload" "$ADMIN_TOKEN")
            log_info "Provisioning start response: $(get_http_code "$start_response")"
            start_attempted=true
        fi
        
        if [ "$status" = "COMPLETED" ] || [ "$status" = "PARTIAL" ] || [ "$status" = "COMPLETED_WITH_WARNINGS" ]; then
            log_success "Provisioning completed with status: $status"
            return 0
        fi
        
        if [ "$status" = "FAILED" ]; then
            log_error "Provisioning failed: $(get_response_body "$response")"
            return 1
        fi
        
        elapsed=$((elapsed + check_interval))
        sleep $check_interval
        log_info "Provisioning in progress... (${elapsed}s/${max_wait}s)"
    done
    
    log_error "Provisioning timeout after ${max_wait}s"
    return 1
}

# ==================== Validation Functions ====================
validate_no_placeholders() {
    local text="$1"
    local context="${2:-data}"
    
    local placeholder_patterns=(
        "Test"
        "Sample"
        "Example"
        "Demo"
        "Placeholder"
        "Account 1"
        "User 1"
        "Item 1"
        "xxx"
        "yyy"
        "zzz"
    )
    
    for pattern in "${placeholder_patterns[@]}"; do
        if echo "$text" | grep -qi "$pattern"; then
            log_error "Placeholder detected in $context: $pattern"
            return 1
        fi
    done
    
    return 0
}

validate_account_exists() {
    local account_name="$1"
    local tenant_id="$2"
    local company="${3:-${TENANT_NAME}}"
    
    local response=$(make_request "GET" "/accounting/accounts?company=${company}")
    local accounts=$(get_response_body "$response")
    
    if echo "$accounts" | jq -e ".data[] | select(.account_name == \"$account_name\")" > /dev/null 2>&1; then
        log_success "Account exists: $account_name"
        return 0
    else
        log_error "Account not found: $account_name"
        return 1
    fi
}

validate_gl_balance() {
    local gl_entries="$1"
    
    local total_debit=$(echo "$gl_entries" | jq '[.[] | .debit // 0] | add')
    local total_credit=$(echo "$gl_entries" | jq '[.[] | .credit // 0] | add')
    
    # Allow small rounding differences (0.01)
    local diff=$(echo "$total_debit - $total_credit" | bc | awk '{if ($1<0) print -$1; else print $1}')
    
    if (( $(echo "$diff < 0.01" | bc -l) )); then
        log_success "GL entries balance: Debit=$total_debit, Credit=$total_credit"
        return 0
    else
        log_error "GL entries do not balance: Debit=$total_debit, Credit=$total_credit, Diff=$diff"
        return 1
    fi
}

# ==================== Test Result Tracking ====================
TEST_RESULTS=()
TEST_PHASES=()

record_test_result() {
    local phase="$1"
    local status="$2"  # pass, fail, skip
    local message="${3:-}"
    local duration="${4:-0}"
    
    TEST_RESULTS+=("{\"phase\":\"$phase\",\"status\":\"$status\",\"message\":\"$message\",\"duration\":$duration}")
    TEST_PHASES+=("$phase")
}

get_test_summary() {
    local total=${#TEST_RESULTS[@]}
    local passed=0
    local failed=0
    local skipped=0
    
    for result in "${TEST_RESULTS[@]}"; do
        local status=$(echo "$result" | jq -r '.status')
        case "$status" in
            pass) passed=$((passed + 1)) ;;
            fail) failed=$((failed + 1)) ;;
            skip) skipped=$((skipped + 1)) ;;
        esac
    done
    
    echo "{\"total\":$total,\"passed\":$passed,\"failed\":$failed,\"skipped\":$skipped}"
}

# ==================== Error Handling ====================
handle_error() {
    local phase="$1"
    local error_message="$2"
    local http_code="${3:-}"
    
    log_error "Error in phase '$phase': $error_message"
    if [ -n "$http_code" ]; then
        log_error "HTTP Status Code: $http_code"
    fi
    
    record_test_result "$phase" "fail" "$error_message"
    
    # Decide whether to continue or stop
    # For critical phases, we might want to stop
    case "$phase" in
        "workspace_creation"|"authentication")
            log_error "Critical phase failed, stopping tests"
            exit 1
            ;;
        *)
            log_info "Non-critical phase failed, continuing..."
            ;;
    esac
}

# ==================== Cleanup Functions ====================
cleanup_test_data() {
    log_info "Cleaning up test data..."
    # Implementation depends on cleanup requirements
    # For now, just clear tokens
    clear_tokens
}

# ==================== Report Generation Helpers ====================
generate_json_report() {
    local start_time="$1"
    local end_time="$2"
    local summary=$(get_test_summary)
    
    local report=$(jq -n \
        --arg start_time "$start_time" \
        --arg end_time "$end_time" \
        --argjson summary "$summary" \
        --argjson results "$(printf '%s\n' "${TEST_RESULTS[@]}" | jq -s .)" \
        '{
            "test_name": "End-to-End POS System Test",
            "start_time": $start_time,
            "end_time": $end_time,
            "summary": $summary,
            "results": $results
        }')
    
    echo "$report" > "${TEST_REPORT_JSON}"
    log_success "JSON report generated: ${TEST_REPORT_JSON}"
}

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    log_error "jq is required but not installed. Please install jq to run tests."
    exit 1
fi

# Check if bc is installed (for calculations)
if ! command -v bc &> /dev/null; then
    log_error "bc is required but not installed. Please install bc to run tests."
    exit 1
fi
