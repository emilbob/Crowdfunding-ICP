#!/usr/bin/env bash
# Downloads a real ICRC-1/ICRC-2 ledger canister (wasm + Candid) for local
# testing. The artifacts land in test/.ledger/ and are gitignored.
set -euo pipefail

# Pinned to a dfinity/ic release commit. Bump deliberately; do not float.
IC_COMMIT="0c121276f3156e97de98151d5f6bec6b73695f9f"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/.ledger"
mkdir -p "$DIR"

if [[ -f "$DIR/icrc1_ledger.wasm.gz" && -f "$DIR/icrc1_ledger.did" ]]; then
    echo "ledger artifacts already present in $DIR"
    exit 0
fi

echo "downloading ICRC-1 ledger @ $IC_COMMIT ..."
curl -fsSL -o "$DIR/icrc1_ledger.wasm.gz" \
    "https://download.dfinity.systems/ic/$IC_COMMIT/canisters/ic-icrc1-ledger.wasm.gz"
curl -fsSL -o "$DIR/icrc1_ledger.did" \
    "https://raw.githubusercontent.com/dfinity/ic/$IC_COMMIT/rs/ledger_suite/icrc1/ledger/ledger.did"

echo "ledger artifacts ready in $DIR"
