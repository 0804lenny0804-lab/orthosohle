#!/usr/bin/env bash
# Build an unsigned, standalone Release app for AltServer re-signing.
# Run on macOS with Xcode, CocoaPods and Node after npm ci.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
app_root="$repo_root/code/mobile"
output_root="$repo_root/artifacts/local/iphone"
mkdir -p "$output_root"

if [[ "$(uname -s)" != Darwin ]]; then
  echo 'An iPhone native build requires macOS and Xcode.' >&2
  exit 1
fi

cd "$app_root"
# Native source is reproducibly derived from app.json and installed Expo packages.
npx --no-install expo prebuild --platform ios --no-install --clean
cd ios
pod install
cd "$app_root"

xcodebuild \
  -workspace ios/OrthoSohle.xcworkspace \
  -scheme OrthoSohle \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -archivePath "$output_root/OrthoSohle.xcarchive" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY='' \
  COMPILER_INDEX_STORE_ENABLE=NO \
  archive 2>&1 | tee "$output_root/xcodebuild.log"

app_bundle="$output_root/OrthoSohle.xcarchive/Products/Applications/OrthoSohle.app"
test -d "$app_bundle"
test -f "$app_bundle/main.jsbundle"
# The Release bundle must contain the UI, so no Metro server is needed on the phone.
bundle_executable="$(/usr/libexec/PlistBuddy -c 'Print CFBundleExecutable' "$app_bundle/Info.plist")"
file "$app_bundle/$bundle_executable" | grep -q arm64
package_root="$(mktemp -d)"
trap 'rm -rf "$package_root"' EXIT
mkdir "$package_root/Payload"
ditto "$app_bundle" "$package_root/Payload/OrthoSohle.app"
(cd "$package_root" && zip -qry "$output_root/OrthoSohle-unsigned.ipa" Payload)

{
  echo 'OrthoSohle unsigned iPhone test build; requires local re-signing.'
  echo "Source: $(git -C "$repo_root" rev-parse HEAD)"
  echo "Created (UTC): $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  xcodebuild -version
  echo "Minimum iOS: $(/usr/libexec/PlistBuddy -c 'Print MinimumOSVersion' "$app_bundle/Info.plist")"
  shasum -a 256 "$output_root/OrthoSohle-unsigned.ipa"
} > "$output_root/build-info.txt"
