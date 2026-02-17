#!/usr/bin/env bash

set -u

BASE_URL="http://127.0.0.1:8181"
TIMEOUT_SECONDS=8
ACTIVE_WRITE_TESTS=0

usage() {
  cat <<'EOF'
Usage: probe-scrutiny-api.sh [options]

Options:
  --base-url URL            Base Scrutiny URL (default: http://127.0.0.1:8181)
  --timeout SECONDS         Curl timeout in seconds (default: 8)
  --active-write-tests      Also test write-like endpoints (POST probes)
  -h, --help                Show this help

Examples:
  ./scripts/probe-scrutiny-api.sh
  ./scripts/probe-scrutiny-api.sh --base-url http://scrutiny.local:8181
  ./scripts/probe-scrutiny-api.sh --active-write-tests
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url)
      BASE_URL="${2:-}"
      shift 2
      ;;
    --timeout)
      TIMEOUT_SECONDS="${2:-}"
      shift 2
      ;;
    --active-write-tests)
      ACTIVE_WRITE_TESTS=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if ! command -v curl >/dev/null 2>&1; then
  echo "Error: curl is required" >&2
  exit 1
fi

trim_trailing_slash() {
  local input="$1"
  echo "${input%/}"
}

BASE_URL="$(trim_trailing_slash "$BASE_URL")"

temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT

print_divider() {
  printf '%s\n' "--------------------------------------------------------------------------------"
}

run_probe() {
  local method="$1"
  local path="$2"
  local payload="${3:-}"
  local label="${4:-}"

  local url="${BASE_URL}${path}"
  local headers_file="$temp_dir/headers.txt"
  local body_file="$temp_dir/body.txt"
  : > "$headers_file"
  : > "$body_file"

  local curl_args=(
    -sS
    -m "$TIMEOUT_SECONDS"
    -X "$method"
    -D "$headers_file"
    -o "$body_file"
    -w "%{http_code}"
    "$url"
  )

  if [[ -n "$payload" ]]; then
    curl_args+=(-H "Content-Type: application/json" --data "$payload")
  fi

  local status
  if ! status="$(curl "${curl_args[@]}" 2>"$temp_dir/error.txt")"; then
    status="ERR"
  fi

  local content_type
  content_type="$(awk -F': ' 'tolower($1)=="content-type" {print $2}' "$headers_file" | tr -d '\r' | head -n1)"

  local allow_header
  allow_header="$(awk -F': ' 'tolower($1)=="allow" {print $2}' "$headers_file" | tr -d '\r' | head -n1)"

  local body_preview
  body_preview="$(tr '\n' ' ' < "$body_file" | sed 's/[[:space:]]\+/ /g' | cut -c1-180)"
  if [[ -z "$body_preview" ]]; then
    body_preview="<empty>"
  fi

  local json_hint="no"
  if [[ "$content_type" == *"json"* ]]; then
    json_hint="yes"
  fi

  if [[ "$status" == "ERR" ]]; then
    local err
    err="$(tr '\n' ' ' < "$temp_dir/error.txt" | sed 's/[[:space:]]\+/ /g' | cut -c1-180)"
    printf '%-8s %-34s %-5s json=%-3s %s\n' "$method" "$path" "ERR" "no" "${label:-}"
    echo "  error: ${err}"
    return
  fi

  printf '%-8s %-34s %-5s json=%-3s %s\n' "$method" "$path" "$status" "$json_hint" "${label:-}"
  if [[ -n "$content_type" ]]; then
    echo "  content-type: $content_type"
  fi
  if [[ -n "$allow_header" ]]; then
    echo "  allow: $allow_header"
  fi
  echo "  body: $body_preview"
}

extract_first_device_id() {
  local body_file="$1"

  # Try common key names for ids/wwn values in JSON-like payloads.
  local id
  id="$(grep -Eo '"(wwn|device_wwn|id|device_id)"[[:space:]]*:[[:space:]]*"[^"]+"' "$body_file" \
    | head -n1 \
    | sed -E 's/.*"([^"]+)"[[:space:]]*$/\1/')"

  if [[ -n "$id" ]]; then
    echo "$id"
  fi
}

echo "Scrutiny API Probe"
echo "base_url=${BASE_URL}"
echo "timeout=${TIMEOUT_SECONDS}s"
echo "active_write_tests=${ACTIVE_WRITE_TESTS}"
print_divider

run_probe "GET"  "/" "" "ui root"
run_probe "GET"  "/api" "" "api root"
run_probe "HEAD" "/api" "" "method support"
run_probe "OPTIONS" "/api" "" "method support"
print_divider

candidate_paths=(
  "/api/health"
  "/api/ping"
  "/api/version"
  "/api/info"
  "/api/summary"
  "/api/system"
  "/api/metrics"
  "/api/device"
  "/api/devices"
  "/api/settings"
  "/api/collector/status"
)

for path in "${candidate_paths[@]}"; do
  run_probe "GET" "$path"
done

print_divider
echo "Capability summary"

api_status="$(curl -sS -m "$TIMEOUT_SECONDS" -o /dev/null -w "%{http_code}" "${BASE_URL}/api" 2>/dev/null || true)"
if [[ "$api_status" == "000" || -z "$api_status" ]]; then
  echo "- API root not reachable"
elif [[ "$api_status" =~ ^2|3 ]]; then
  echo "- API root reachable (status $api_status)"
else
  echo "- API root returned status $api_status"
fi

# Probe device collection once and attempt dynamic endpoint checks.
device_headers="$temp_dir/device_headers.txt"
device_body="$temp_dir/device_body.txt"
device_status="$(curl -sS -m "$TIMEOUT_SECONDS" -D "$device_headers" -o "$device_body" -w "%{http_code}" "${BASE_URL}/api/device" 2>/dev/null || true)"

if [[ "$device_status" =~ ^2|3 ]]; then
  echo "- Device listing endpoint appears available (/api/device -> $device_status)"
  device_id="$(extract_first_device_id "$device_body")"
  if [[ -n "${device_id:-}" ]]; then
    echo "- Found candidate device id: ${device_id}"
    run_probe "GET" "/api/device/${device_id}" "" "dynamic endpoint"
    run_probe "OPTIONS" "/api/device/${device_id}/smart" "" "dynamic endpoint"
    if [[ "$ACTIVE_WRITE_TESTS" -eq 1 ]]; then
      run_probe "POST" "/api/device/${device_id}/smart" "{}" "write-like probe"
    else
      echo "- Skipped POST /api/device/{id}/smart (enable with --active-write-tests)"
    fi
  else
    echo "- Could not extract a device id from /api/device response"
  fi
elif [[ "$device_status" == "000" || -z "$device_status" ]]; then
  echo "- /api/device unreachable (connection error)"
else
  echo "- /api/device returned status $device_status"
fi

print_divider
echo "Done."
