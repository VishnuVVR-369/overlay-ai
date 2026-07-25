#!/usr/bin/env bash

# Build the current repository revision and atomically replace the installed
# Apple Silicon app. The existing app stays untouched until the replacement
# bundle has been built, copied to a staging location, and validated.

set -euo pipefail

readonly APP_NAME='Overlay AI.app'
readonly APP_PATH="/Applications/${APP_NAME}"
readonly BUNDLE_ID='ai.overlay.app'
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly DRY_RUN="${1:-}"

if [[ "${DRY_RUN}" != '' && "${DRY_RUN}" != '--dry-run' ]]; then
  echo "Usage: $(basename "$0") [--dry-run]" >&2
  exit 2
fi

if [[ "$(uname -s)" != 'Darwin' ]]; then
  echo 'This installer only supports macOS.' >&2
  exit 1
fi

if [[ "$(uname -m)" != 'arm64' ]]; then
  echo 'This installer builds the Apple Silicon app and must run on an arm64 Mac.' >&2
  exit 1
fi

cleanup_paths=()
cleanup() {
  local path
  for path in "${cleanup_paths[@]:-}"; do
    [[ -e "${path}" ]] && rm -rf -- "${path}"
  done
}
trap cleanup EXIT

validate_app() {
  local app_path="$1"
  local plist="${app_path}/Contents/Info.plist"
  local executable="${app_path}/Contents/MacOS/Overlay AI"

  [[ -x "${executable}" ]] || { echo 'Replacement app executable is missing.' >&2; return 1; }
  plutil -lint "${plist}" >/dev/null
  [[ "$(plutil -extract CFBundleIdentifier raw "${plist}")" == "${BUNDLE_ID}" ]] || {
    echo 'Replacement bundle identifier does not match Overlay AI.' >&2
    return 1
  }
  lipo -archs "${executable}" | tr ' ' '\n' | grep -qx 'arm64'
}

cd "${PROJECT_DIR}"

if [[ -n "$(git status --porcelain)" ]]; then
  echo 'Refusing to update a working tree with uncommitted changes.' >&2
  exit 1
fi

echo 'Updating source to its latest upstream revision...'
git pull --ff-only

echo 'Installing locked dependencies...'
npm ci

echo 'Building the Apple Silicon application bundle...'
npx electron-vite build
npx electron-builder --mac --arm64 --dir --publish never

readonly BUILT_APP="${PROJECT_DIR}/release/mac-arm64/${APP_NAME}"
if [[ ! -d "${BUILT_APP}" ]]; then
  echo "Expected built app was not found: ${BUILT_APP}" >&2
  exit 1
fi

readonly STAGE_DIR="$(mktemp -d /tmp/overlay-ai-install.XXXXXX)"
cleanup_paths+=("${STAGE_DIR}")
readonly STAGED_APP="${STAGE_DIR}/${APP_NAME}"

echo 'Staging and validating the replacement app before touching the installed app...'
ditto "${BUILT_APP}" "${STAGED_APP}"
validate_app "${STAGED_APP}"

if [[ "${DRY_RUN}" == '--dry-run' ]]; then
  echo "Validated staged replacement: ${STAGED_APP}"
  echo 'Dry run complete; the installed app was not changed.'
  exit 0
fi

echo 'Stopping the currently installed app, if it is running...'
osascript -e "tell application id \"${BUNDLE_ID}\" to quit" >/dev/null 2>&1 || true
for _ in {1..10}; do
  pgrep -x 'Overlay AI' >/dev/null || break
  sleep 1
done
if pgrep -x 'Overlay AI' >/dev/null; then
  echo 'Overlay AI did not exit; leaving the existing app untouched.' >&2
  exit 1
fi

readonly BACKUP_APP="/Applications/.${APP_NAME}.previous.$$"
if [[ -e "${APP_PATH}" ]]; then
  mv "${APP_PATH}" "${BACKUP_APP}"
fi

if ! mv "${STAGED_APP}" "${APP_PATH}"; then
  [[ -e "${BACKUP_APP}" ]] && mv "${BACKUP_APP}" "${APP_PATH}"
  echo 'Installation failed; restored the previous app.' >&2
  exit 1
fi

# Validate the final installed copy before permanently deleting the previous app.
if ! validate_app "${APP_PATH}"; then
  rm -rf -- "${APP_PATH}"
  [[ -e "${BACKUP_APP}" ]] && mv "${BACKUP_APP}" "${APP_PATH}"
  echo 'Installed app failed final validation; restored the previous app.' >&2
  exit 1
fi

[[ -e "${BACKUP_APP}" ]] && rm -rf -- "${BACKUP_APP}"
echo "Installed $(plutil -extract CFBundleShortVersionString raw "${APP_PATH}/Contents/Info.plist") at ${APP_PATH}"
