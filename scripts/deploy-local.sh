#!/usr/bin/env bash
# Brings up the whole dapp on a local replica: ledger, Internet Identity, the
# crowdfund canister, and the frontend. Safe to re-run.
#
# Usage:  npm run start && npm run deploy:local
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

dfx() { command dfx "$@" 2>&1 | grep -v "dfx is deprecated" || true; }

if ! command dfx ping >/dev/null 2>&1; then
    echo "no local replica — run 'npm run start' first" >&2
    exit 1
fi

bash scripts/setup-local-canisters.sh

echo
echo "=== creating canisters ==="
dfx canister create --all

# The minting account MUST be a different principal from any account that
# contributes. An ICRC-1 transfer out of the minting account is a mint, and the
# ledger refuses to let a mint be delegated via icrc2_transfer_from — so if your
# own identity were the minter, contributing through the UI would always fail
# with "the minter account cannot delegate mints".
command dfx identity list 2>/dev/null | grep -qx "crowdfund-minter" ||
    command dfx identity new crowdfund-minter --storage-mode plaintext >/dev/null 2>&1

MINTER=$(command dfx identity get-principal --identity crowdfund-minter 2>/dev/null)
HOLDER=$(command dfx identity get-principal 2>/dev/null)
echo "minting account: $MINTER (crowdfund-minter)"
echo "funded account:  $HOLDER (your current dfx identity)"

echo
echo "=== ledger ==="
# Idempotent: reinstall so re-running gives a clean, predictable ledger state.
dfx deploy icrc1_ledger --mode reinstall --yes --argument "(variant { Init = record {
  minting_account = record { owner = principal \"$MINTER\"; subaccount = null };
  fee_collector_account = null;
  transfer_fee = 10_000 : nat;
  decimals = opt (8 : nat8);
  max_memo_length = null;
  token_symbol = \"TEST\";
  token_name = \"Test Token\";
  metadata = vec {};
  initial_balances = vec { record { record { owner = principal \"$HOLDER\"; subaccount = null }; 1_000_000_000_000 : nat } };
  feature_flags = opt record { icrc2 = true; icrc152 = false };
  archive_options = record {
    num_blocks_to_archive = 1000 : nat64;
    max_transactions_per_response = null;
    trigger_threshold = 2000 : nat64;
    max_message_size_bytes = null;
    cycles_for_archive_creation = opt (10_000_000_000_000 : nat64);
    node_max_memory_size_bytes = null;
    controller_id = principal \"$HOLDER\";
    more_controller_ids = null;
  };
  index_principal = null;
}})"

echo
echo "=== internet identity ==="
dfx deploy internet_identity --argument '(null)'

echo
echo "=== crowdfund canister ==="
LEDGER=$(command dfx canister id icrc1_ledger 2>/dev/null)
dfx deploy crowdfund --argument "(principal \"$LEDGER\")"

echo
echo "=== frontend ==="
# The frontend imports dfx's generated Candid bindings, which are gitignored.
# `dfx build` does not produce them — only `dfx generate` does — so a fresh
# clone needs this before the Vite build can resolve @declarations/*.
dfx generate crowdfund
dfx deploy crowdfund_frontend

FRONTEND=$(command dfx canister id crowdfund_frontend 2>/dev/null)
II=$(command dfx canister id internet_identity 2>/dev/null)

cat <<EOF

────────────────────────────────────────────────
  App               http://${FRONTEND}.localhost:4943
  Internet Identity http://${II}.localhost:4943
  Ledger            ${LEDGER}  (TEST, 8 decimals, fee 10_000)

  New Internet Identity principals start with a zero
  balance. After signing in, copy the principal shown
  in the header and fund it:

    ./scripts/mint.sh <principal> 5000000000
────────────────────────────────────────────────
EOF
