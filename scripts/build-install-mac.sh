#!/usr/bin/env bash

set -euo pipefail

APP_NAME="${APP_NAME:-Overlay AI}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_DIR="${INSTALL_DIR:-/Applications}"
INSTALL_PATH="${INSTALL_DIR}/${APP_NAME}.app"
DIST_DIR="${DIST_DIR:-${ROOT_DIR}/dist/release}"
PACKAGE_SCRIPT="${PACKAGE_SCRIPT:-package:mac}"
SKIP_BUILD="${SKIP_BUILD:-0}"
FORCE_REINSTALL="${FORCE_REINSTALL:-1}"

MOUNT_POINT=""
DMG_PATH="${DMG_PATH:-}"

log() {
  printf '==> %s\n' "$1"
}

error() {
  printf 'Error: %s\n' "$1" >&2
}

cleanup() {
  if [[ -n "${MOUNT_POINT}" && -d "${MOUNT_POINT}" ]]; then
    hdiutil detach "${MOUNT_POINT}" -quiet >/dev/null 2>&1 || true
    rmdir "${MOUNT_POINT}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

require_macos() {
  if [[ "$(uname -s)" != "Darwin" ]]; then
    error "This script only supports macOS."
    exit 1
  fi
}

require_command() {
  local command_name="$1"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    error "Required command not found: ${command_name}"
    exit 1
  fi
}

run_with_sudo_if_needed() {
  if [[ -w "${INSTALL_DIR}" ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

ensure_project_ready() {
  if [[ ! -f "${ROOT_DIR}/package.json" ]]; then
    error "package.json not found under ${ROOT_DIR}"
    exit 1
  fi

  if [[ "${SKIP_BUILD}" == "1" ]]; then
    return
  fi

  if [[ ! -d "${ROOT_DIR}/node_modules" ]]; then
    error "node_modules is missing. Run 'npm install' first."
    exit 1
  fi
}

build_release() {
  if [[ "${SKIP_BUILD}" == "1" ]]; then
    log "Skipping build because SKIP_BUILD=1"
    return
  fi

  log "Building and packaging macOS release"
  (
    cd "${ROOT_DIR}"
    npm run "${PACKAGE_SCRIPT}"
  )
}

detect_arch() {
  if [[ "$(sysctl -in hw.optional.arm64 2>/dev/null || printf '0')" == "1" ]]; then
    printf 'arm64'
    return
  fi

  case "$(uname -m)" in
    arm64|aarch64)
      printf 'arm64'
      ;;
    x86_64)
      printf 'x64'
      ;;
    *)
      printf 'unknown'
      ;;
  esac
}

pick_latest_file() {
  local latest_file=""
  local latest_mtime="-1"
  local candidate=""
  local candidate_mtime=""

  for candidate in "$@"; do
    candidate_mtime="$(stat -f '%m' "${candidate}" 2>/dev/null || printf '%s' 0)"
    if [[ "${candidate_mtime}" -gt "${latest_mtime}" ]]; then
      latest_mtime="${candidate_mtime}"
      latest_file="${candidate}"
    fi
  done

  printf '%s\n' "${latest_file}"
}

pick_latest_dmg() {
  local -a dmgs=()
  local -a preferred_dmgs=()
  local current_arch
  local file

  if [[ -n "${DMG_PATH}" ]]; then
    if [[ ! -f "${DMG_PATH}" ]]; then
      error "Specified DMG does not exist: ${DMG_PATH}"
      exit 1
    fi
    return
  fi

  while IFS= read -r -d '' file; do
    dmgs+=("${file}")
  done < <(find "${DIST_DIR}" -type f -name "*.dmg" -print0 2>/dev/null)

  if [[ ${#dmgs[@]} -eq 0 ]]; then
    error "No DMG files found under ${DIST_DIR}"
    exit 1
  fi

  current_arch="$(detect_arch)"
  for file in "${dmgs[@]}"; do
    case "${current_arch}" in
      arm64)
        [[ "${file}" == *arm64.dmg ]] && preferred_dmgs+=("${file}")
        ;;
      x64)
        if [[ "${file}" == *x64.dmg ]] || [[ "${file}" != *arm64.dmg ]]; then
          preferred_dmgs+=("${file}")
        fi
        ;;
    esac
  done

  if [[ ${#preferred_dmgs[@]} -gt 0 ]]; then
    DMG_PATH="$(pick_latest_file "${preferred_dmgs[@]}")"
  else
    DMG_PATH="$(pick_latest_file "${dmgs[@]}")"
  fi

  if [[ -z "${DMG_PATH}" || ! -f "${DMG_PATH}" ]]; then
    error "Unable to determine the DMG to install."
    exit 1
  fi
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --skip-build)
        SKIP_BUILD="1"
        ;;
      --dmg)
        shift
        if [[ $# -eq 0 ]]; then
          error "--dmg requires a file path"
          exit 1
        fi
        DMG_PATH="$1"
        ;;
      --install-dir)
        shift
        if [[ $# -eq 0 ]]; then
          error "--install-dir requires a directory path"
          exit 1
        fi
        INSTALL_DIR="$1"
        INSTALL_PATH="${INSTALL_DIR}/${APP_NAME}.app"
        ;;
      --help|-h)
        cat <<EOF
Usage: $(basename "${BASH_SOURCE[0]}") [options]

Options:
  --skip-build           Install from an existing DMG instead of packaging first
  --dmg <path>           Install from a specific DMG file
  --install-dir <path>   Override the destination directory (default: /Applications)
  -h, --help             Show this help message

Environment overrides:
  APP_NAME, DIST_DIR, PACKAGE_SCRIPT, SKIP_BUILD, FORCE_REINSTALL, DMG_PATH, INSTALL_DIR
EOF
        exit 0
        ;;
      *)
        error "Unknown argument: $1"
        exit 1
        ;;
    esac
    shift
  done
}

mount_dmg() {
  MOUNT_POINT="$(mktemp -d "/tmp/${APP_NAME// /-}.XXXXXX")"
  log "Mounting DMG"
  hdiutil attach "${DMG_PATH}" -nobrowse -noautoopen -mountpoint "${MOUNT_POINT}" -quiet
}

find_app_bundle() {
  find "${MOUNT_POINT}" -maxdepth 2 -type d -name "${APP_NAME}.app" -print -quit
}

quit_running_app() {
  log "Quitting running app instance if needed"
  osascript -e "tell application \"${APP_NAME}\" to quit" >/dev/null 2>&1 || true
  sleep 1
  pkill -x "${APP_NAME}" >/dev/null 2>&1 || true
}

install_app() {
  local app_bundle="$1"

  if [[ ! -d "${app_bundle}" ]]; then
    error "App bundle not found: ${app_bundle}"
    exit 1
  fi

  if [[ -e "${INSTALL_PATH}" && "${FORCE_REINSTALL}" != "1" ]]; then
    error "${INSTALL_PATH} already exists and FORCE_REINSTALL is not enabled."
    exit 1
  fi

  log "Installing ${APP_NAME}.app to ${INSTALL_DIR}"
  run_with_sudo_if_needed mkdir -p "${INSTALL_DIR}"
  run_with_sudo_if_needed rm -rf "${INSTALL_PATH}"
  run_with_sudo_if_needed ditto "${app_bundle}" "${INSTALL_PATH}"
}

main() {
  local app_bundle

  parse_args "$@"
  require_macos
  require_command hdiutil
  require_command osascript
  require_command ditto
  if [[ "${SKIP_BUILD}" != "1" ]]; then
    require_command npm
  fi
  ensure_project_ready
  build_release
  pick_latest_dmg

  log "Using DMG: ${DMG_PATH}"
  mount_dmg

  app_bundle="$(find_app_bundle)"
  if [[ -z "${app_bundle}" ]]; then
    error "Could not find ${APP_NAME}.app inside ${DMG_PATH}"
    exit 1
  fi

  quit_running_app
  install_app "${app_bundle}"

  log "Installed: ${INSTALL_PATH}"
  log "Done"
}

main "$@"
