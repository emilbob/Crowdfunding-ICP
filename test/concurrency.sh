#!/usr/bin/env bash
# Races the canister against itself to prove the reserve-then-call-then-compensate
# pattern actually holds under contention, rather than merely being reasoned about.
#
# Usage:  npm run test:concurrency   (requires a running replica: npm run start)
#
# WHY THIS EXISTS
# Every await on an inter-canister call is a commit point: state is written and
# other messages run before the response arrives. A sequential test cannot
# produce that interleaving, so it cannot distinguish correct code from code
# that merely looks correct. These tests fire genuinely simultaneous ingress
# messages and then assert on invariants that only hold if the synchronous
# reservation is doing its job.
#
# The load-bearing assertion in each case is the LEDGER BALANCE. Internal
# bookkeeping can be self-consistent and still wrong; the ledger is the
# independent witness to what actually moved.
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

# Filters dfx's deprecation banner while PRESERVING its exit status. A bare
# `command dfx ... | grep -v ...` returns *grep's* status, and a failing dfx
# still prints error text for grep to match — so the `|| exit 1` guards below
# would never fire.
dfx() {
    local output status
    output=$(command dfx "$@" 2>&1)
    status=$?
    printf '%s\n' "$output" | grep -v "dfx is deprecated" || true
    return $status
}

PASS=0
FAIL=0
check() {
    if [[ "$2" == "$3" ]]; then
        PASS=$((PASS + 1)); printf '  ok   %s (%s)\n' "$1" "$2"
    else
        FAIL=$((FAIL + 1)); printf '  FAIL %s\n       expected: %s\n       actual:   %s\n' "$1" "$2" "$3"
    fi
}

# Strips Candid formatting down to a bare integer: "(1_000_000 : nat)" -> 1000000
num() { tr -d ' \n' <<<"$1" | grep -oE '[0-9_]+' | head -1 | tr -d '_'; }

if ! dfx ping >/dev/null 2>&1; then
    echo "no local replica — run 'npm run start' first" >&2
    exit 1
fi

bash scripts/setup-local-canisters.sh || exit 1

for id in crowdfund-minter backer; do
    dfx identity list 2>/dev/null | grep -qx "$id" || \
        dfx identity new "$id" --storage-mode plaintext >/dev/null 2>&1
done
OWNER=$(dfx identity get-principal --identity default)
MINTER=$(dfx identity get-principal --identity crowdfund-minter)
BACKER=$(dfx identity get-principal --identity backer)

dfx canister create crowdfund icrc1_ledger >/dev/null 2>&1

echo "=== deploying a clean ledger and canister ==="
dfx deploy icrc1_ledger --mode reinstall --yes --argument "(variant { Init = record {
  minting_account = record { owner = principal \"$MINTER\"; subaccount = null };
  fee_collector_account = null;
  transfer_fee = 10_000 : nat;
  decimals = opt (8 : nat8);
  max_memo_length = null;
  token_symbol = \"TEST\";
  token_name = \"Test Token\";
  metadata = vec {};
  initial_balances = vec { record { record { owner = principal \"$BACKER\"; subaccount = null }; 100_000_000_000 : nat } };
  feature_flags = opt record { icrc2 = true; icrc152 = false };
  archive_options = record {
    num_blocks_to_archive = 1000 : nat64;
    max_transactions_per_response = null;
    trigger_threshold = 2000 : nat64;
    max_message_size_bytes = null;
    cycles_for_archive_creation = opt (10_000_000_000_000 : nat64);
    node_max_memory_size_bytes = null;
    controller_id = principal \"$OWNER\";
    more_controller_ids = null;
  };
  index_principal = null;
}})" >/dev/null || { echo "ledger deploy failed" >&2; exit 1; }

LEDGER=$(dfx canister id icrc1_ledger)
dfx deploy crowdfund --mode reinstall --yes --argument "(principal \"$LEDGER\")" >/dev/null \
    || { echo "crowdfund deploy failed" >&2; exit 1; }
CF=$(dfx canister id crowdfund)

bal() { num "$(dfx canister call icrc1_ledger icrc1_balance_of \
    "(record { owner = principal \"$1\"; subaccount = null })" --identity backer)"; }

field() { # field <campaign-id> <name>
    dfx canister call crowdfund getCampaign "(\"$1\")" \
        | grep -oE "$2 = [0-9_]+" | head -1 | grep -oE '[0-9_]+' | tr -d '_'
}

approve() {
    dfx canister call icrc1_ledger icrc2_approve \
        "(record { fee = null; memo = null; from_subaccount = null; created_at_time = null;
                   amount = $1 : nat; expected_allowance = null; expires_at = null;
                   spender = record { owner = principal \"$CF\"; subaccount = null } })" \
        --identity backer >/dev/null
}

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo
echo "════ 1. concurrent contributions cannot overshoot the goal ════"
# Goal 1_000_000 with eight simultaneous 300_000 contributions in flight:
# 2_400_000 chasing 1_000_000 of capacity. If the reservation happened after
# the ledger call instead of before it, every one of these would read the same
# stale `remaining` and the campaign would end up over its goal.
dfx canister call crowdfund createCampaign \
    '(record {title = "Race"; description = "contention"; goalAmount = 1_000_000 : nat; durationDays = 30 : nat64})' \
    --identity default >/dev/null
approve 5_000_000

BACKER_BEFORE=$(bal "$BACKER")

for i in $(seq 1 8); do
    dfx canister call crowdfund contribute '("0", 300_000 : nat)' --identity backer \
        > "$TMP/c$i.out" 2>&1 &
done
wait

OKS=$(grep -l 'Ok =' "$TMP"/c*.out 2>/dev/null | wc -l | tr -d ' ')
echo "  ($OKS of 8 contributions accepted)"

CURRENT=$(field 0 currentAmount)
HELD=$(bal "$CF")
RECORDED=$(dfx canister call crowdfund listContributions '("0")' \
    | grep -oE 'amount = [0-9_]+' | grep -oE '[0-9_]+' | tr -d '_' \
    | awk '{s+=$1} END {print s+0}')

check "campaign lands exactly on its goal, never above" "1000000" "$CURRENT"
check "canister holds exactly what the campaign claims" "$CURRENT" "$HELD"
check "recorded contributions sum to the campaign total" "$CURRENT" "$RECORDED"

# Every accepted contribution costs the backer its amount plus one transfer fee;
# rejected ones must cost nothing at all.
BACKER_AFTER=$(bal "$BACKER")
SPENT=$((BACKER_BEFORE - BACKER_AFTER))
EXPECTED_SPENT=$((CURRENT + OKS * 10000))
check "backer debited only for accepted contributions" "$EXPECTED_SPENT" "$SPENT"

echo
echo "════ 2. concurrent withdrawals pay out exactly once ════"
# Five simultaneous withdrawals of a funded campaign. Without the flag being
# set synchronously before the ledger call, more than one could pass the guard
# and the canister would pay out twice.
OWNER_BEFORE=$(bal "$OWNER")

for i in $(seq 1 5); do
    dfx canister call crowdfund withdrawFunds '("0")' --identity default \
        > "$TMP/w$i.out" 2>&1 &
done
wait

W_OK=$(grep -l 'Ok =' "$TMP"/w*.out 2>/dev/null | wc -l | tr -d ' ')
OWNER_AFTER=$(bal "$OWNER")
GAINED=$((OWNER_AFTER - OWNER_BEFORE))

check "exactly one withdrawal succeeds" "1" "$W_OK"
check "owner is paid the raised total once, less one fee" "990000" "$GAINED"
check "canister is fully drained" "0" "$(bal "$CF")"
check "campaign is flagged settled" "true" \
    "$(dfx canister call crowdfund getCampaign '("0")' | grep -oE 'withdrawn = (true|false)' | grep -oE 'true|false')"

echo
echo "════ 3. a losing racer leaves no trace ════"
# The compensating path must fully undo a reservation whose ledger call failed.
# Contributing with no allowance left forces transfer_from to be rejected, so
# every one of these must roll back cleanly.
dfx canister call crowdfund createCampaign \
    '(record {title = "Rollback"; description = "no allowance"; goalAmount = 500_000 : nat; durationDays = 30 : nat64})' \
    --identity default >/dev/null
approve 0

BEFORE_ROLLBACK=$(bal "$BACKER")
for i in $(seq 1 6); do
    dfx canister call crowdfund contribute '("1", 100_000 : nat)' --identity backer \
        > "$TMP/r$i.out" 2>&1 &
done
wait

check "campaign records nothing after failed transfers" "0" "$(field 1 currentAmount)"
check "canister holds nothing from failed transfers" "0" "$(bal "$CF")"
check "backer is not charged for failed transfers" "$BEFORE_ROLLBACK" "$(bal "$BACKER")"
check "no phantom contributions are listed" "0" \
    "$(dfx canister call crowdfund listContributions '("1")' | grep -oE 'amount = [0-9_]+' | wc -l | tr -d ' ')"

echo
echo "════ $PASS passed, $FAIL failed ════"
[[ $FAIL -eq 0 ]]
