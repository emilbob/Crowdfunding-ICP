#!/usr/bin/env bash
# Funds a principal on the local test ledger.
#
# An ICRC-1 transfer *from* the minting account is a mint, and deploy-local.sh
# sets the minting account to your dfx identity — so this works without any
# special ledger method.
#
# Usage:  ./scripts/mint.sh <principal> [amount]
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

PRINCIPAL="${1:-}"
AMOUNT="${2:-5000000000}"

if [[ -z "$PRINCIPAL" ]]; then
    echo "usage: ./scripts/mint.sh <principal> [amount]" >&2
    echo "  amount is in the ledger's smallest unit (8 decimals)" >&2
    exit 1
fi

RESULT=$(command dfx canister call icrc1_ledger icrc1_transfer --identity crowdfund-minter "(record {
  to = record { owner = principal \"$PRINCIPAL\"; subaccount = null };
  fee = null;
  memo = null;
  from_subaccount = null;
  created_at_time = null;
  amount = $AMOUNT : nat;
})" 2>&1 | grep -v "dfx is deprecated")

echo "$RESULT"

# The ledger reports failures inside an Ok/Err variant, not via exit status, so
# a bare call looks successful even when nothing moved.
if [[ "$RESULT" != *"Ok ="* ]]; then
    echo >&2
    echo "mint FAILED — nothing was transferred." >&2
    if [[ "$RESULT" == *InsufficientFunds* ]]; then
        echo "The crowdfund-minter identity is not this ledger's minting account." >&2
        echo "Running 'npm run test:e2e' reinstalls the ledger with its own test" >&2
        echo "minter, which clobbers the dev one. Re-run 'npm run deploy:local'." >&2
    fi
    exit 1
fi

echo "minted $AMOUNT to $PRINCIPAL"
