#!/usr/bin/env bash
# Downloads the third-party canisters this project depends on locally: an
# ICRC-1/ICRC-2 ledger to settle against, and Internet Identity to sign in with.
#
# On mainnet these are not deployed — dfx.json marks both `remote`, pointing at
# the real ICP ledger and the real Internet Identity. This is local only.
set -euo pipefail

# Pinned deliberately. Bump on purpose, not by drift.
IC_COMMIT="0c121276f3156e97de98151d5f6bec6b73695f9f"
II_RELEASE="release-2026-07-28"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.local-canisters"
mkdir -p "$DIR"

fetch() {
    local url="$1" out="$2"
    if [[ -f "$out" ]]; then
        echo "  have $(basename "$out")"
        return
    fi
    echo "  fetching $(basename "$out")"
    curl -fsSL -o "$out" "$url"
}

echo "local canisters -> $DIR"

# ICRC-1/ICRC-2 ledger
fetch "https://download.dfinity.systems/ic/$IC_COMMIT/canisters/ic-icrc1-ledger.wasm.gz" \
    "$DIR/icrc1_ledger.wasm.gz"
fetch "https://raw.githubusercontent.com/dfinity/ic/$IC_COMMIT/rs/ledger_suite/icrc1/ledger/ledger.did" \
    "$DIR/icrc1_ledger.did"

# Internet Identity. The _dev build skips the captcha and accepts any origin,
# which is what makes local sign-in usable; never deploy it to mainnet.
fetch "https://github.com/dfinity/internet-identity/releases/download/$II_RELEASE/internet_identity_dev.wasm.gz" \
    "$DIR/internet_identity.wasm.gz"
fetch "https://github.com/dfinity/internet-identity/releases/download/$II_RELEASE/internet_identity.did" \
    "$DIR/internet_identity.did"

echo "done"
