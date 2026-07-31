#!/usr/bin/env bash
# End-to-end test of the crowdfund canister against a real ICRC-1/ICRC-2 ledger
# on a local replica. Asserts on actual token balances, not just return values.
#
# Usage:  npm run test:e2e     (requires a running replica: npm run start)
#
# NOTE ON REFUNDS
# The refund *guard* paths are asserted here. The refund *payout* path needs a
# campaign that has passed its end date, and the shortest campaign this canister
# accepts is one day. To exercise the payout, temporarily build with a smaller
# NANOS_PER_DAY in src/index.ts (10_000_000_000n makes "1 day" ten seconds),
# redeploy with --mode reinstall, contribute, wait, then call refund.
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

DFX_JSON_BACKUP="$(mktemp)"
RESTORED=0
restore() {
    if [[ $RESTORED -eq 0 && -s "$DFX_JSON_BACKUP" ]]; then
        cp "$DFX_JSON_BACKUP" dfx.json
        RESTORED=1
        echo; echo "restored dfx.json"
    fi
}
trap restore EXIT INT TERM

dfx() { command dfx "$@" 2>&1 | grep -v "dfx is deprecated"; }

PASS=0
FAIL=0
# check <label> <expected-substring> <actual>
check() {
    if [[ "$3" == *"$2"* ]]; then
        PASS=$((PASS + 1)); printf '  ok   %s\n' "$1"
    else
        FAIL=$((FAIL + 1)); printf '  FAIL %s\n       wanted: %s\n       got:    %s\n' "$1" "$2" "${3//$'\n'/ }"
    fi
}

if ! dfx ping >/dev/null 2>&1; then
    echo "no local replica — run 'npm run start' first" >&2
    exit 1
fi

bash test/setup-ledger.sh || exit 1
LEDGER_DIR="$(pwd)/test/.ledger"

echo "=== preparing identities ==="
for id in minter backer; do
    dfx identity list 2>/dev/null | grep -qx "$id" || \
        dfx identity new "$id" --storage-mode plaintext >/dev/null 2>&1
done
OWNER=$(dfx identity get-principal --identity default)
MINTER=$(dfx identity get-principal --identity minter)
BACKER=$(dfx identity get-principal --identity backer)

# Add the test ledger to dfx.json for the duration of this run only.
cp dfx.json "$DFX_JSON_BACKUP"
node -e '
const fs = require("fs");
const dir = process.argv[1];
const cfg = JSON.parse(fs.readFileSync("dfx.json", "utf8"));
cfg.canisters.icrc1_ledger = {
    type: "custom",
    wasm: dir + "/icrc1_ledger.wasm.gz",
    candid: dir + "/icrc1_ledger.did"
};
fs.writeFileSync("dfx.json", JSON.stringify(cfg, null, 2) + "\n");
' "$LEDGER_DIR"

# Ensure both canisters exist before the reinstalls below; on a fresh replica
# (CI, or after `dfx start --clean`) they do not yet.
dfx canister create --all >/dev/null 2>&1

echo "=== deploying ledger ==="
dfx deploy icrc1_ledger --mode reinstall --yes --argument "(variant { Init = record {
  minting_account = record { owner = principal \"$MINTER\"; subaccount = null };
  fee_collector_account = null;
  transfer_fee = 10_000 : nat;
  decimals = opt (8 : nat8);
  max_memo_length = null;
  token_symbol = \"TEST\";
  token_name = \"Test Token\";
  metadata = vec {};
  initial_balances = vec { record { record { owner = principal \"$BACKER\"; subaccount = null }; 10_000_000_000 : nat } };
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

echo "=== deploying crowdfund ==="
dfx deploy crowdfund --mode reinstall --yes --argument "(principal \"$LEDGER\")" >/dev/null \
    || { echo "crowdfund deploy failed" >&2; exit 1; }
CF=$(dfx canister id crowdfund)

bal() { dfx canister call icrc1_ledger icrc1_balance_of \
    "(record { owner = principal \"$1\"; subaccount = null })" --identity backer; }

echo
echo "=== running assertions ==="

check "getLedger reflects the init argument" "$LEDGER" \
    "$(dfx canister call crowdfund getLedger '()')"

check "createCampaign returns an id" 'Ok = "0"' \
    "$(dfx canister call crowdfund createCampaign \
        '(record {title = "Test"; description = "A real one"; goalAmount = 1_000_000 : nat; durationDays = 30 : nat64})' \
        --identity default)"

check "contribute without an allowance is rejected" "InsufficientAllowance" \
    "$(dfx canister call crowdfund contribute '("0", 600_000 : nat)' --identity backer)"

dfx canister call icrc1_ledger icrc2_approve \
    "(record { fee = null; memo = null; from_subaccount = null; created_at_time = null;
               amount = 2_000_000 : nat; expected_allowance = null; expires_at = null;
               spender = record { owner = principal \"$CF\"; subaccount = null } })" \
    --identity backer >/dev/null

check "contribute succeeds once approved" "Contributed 600000" \
    "$(dfx canister call crowdfund contribute '("0", 600_000 : nat)' --identity backer)"

check "campaign reflects the contribution" "currentAmount = 600_000" \
    "$(dfx canister call crowdfund getCampaign '("0")')"

check "over-goal contribution is capped at the remainder" "reduced from 900000" \
    "$(dfx canister call crowdfund contribute '("0", 900_000 : nat)' --identity backer)"

check "campaign is now exactly at goal" "currentAmount = 1_000_000" \
    "$(dfx canister call crowdfund getCampaign '("0")')"

check "contributing past the goal is refused" "ContributionError" \
    "$(dfx canister call crowdfund contribute '("0", 1 : nat)' --identity backer)"

check "canister actually holds the tokens" "1_000_000 : nat" "$(bal "$CF")"

check "non-owner cannot withdraw" "AuthorizationError" \
    "$(dfx canister call crowdfund withdrawFunds '("0")' --identity backer)"

check "owner withdraws, less the ledger fee" "Withdrew 990000" \
    "$(dfx canister call crowdfund withdrawFunds '("0")' --identity default)"

check "withdrawal is one-shot" "already been withdrawn" \
    "$(dfx canister call crowdfund withdrawFunds '("0")' --identity default)"

check "owner received the payout" "990_000 : nat" "$(bal "$OWNER")"
check "canister balance is drained" "(0 : nat)" "$(bal "$CF")"

check "both contributions are recorded" "600_000" \
    "$(dfx canister call crowdfund listContributions '("0")')"

check "settled campaign is not refundable" "has been settled" \
    "$(dfx canister call crowdfund refund '("0")' --identity backer)"

check "settled campaign can be deleted" "deleted successfully" \
    "$(dfx canister call crowdfund deleteCampaign '("0")' --identity default)"

dfx canister call crowdfund createCampaign \
    '(record {title = "Second"; description = "held funds"; goalAmount = 500_000 : nat; durationDays = 1 : nat64})' \
    --identity default >/dev/null
dfx canister call crowdfund contribute '("1", 100_000 : nat)' --identity backer >/dev/null

check "cannot delete a campaign still holding funds" "still holding contributions" \
    "$(dfx canister call crowdfund deleteCampaign '("1")' --identity default)"

check "cannot refund an active campaign" "still active" \
    "$(dfx canister call crowdfund refund '("1")' --identity backer)"

check "empty title rejected" "title and description" \
    "$(dfx canister call crowdfund createCampaign \
        '(record {title = ""; description = "d"; goalAmount = 1 : nat; durationDays = 1 : nat64})' --identity default)"

check "zero goal rejected" "must be positive" \
    "$(dfx canister call crowdfund createCampaign \
        '(record {title = "t"; description = "d"; goalAmount = 0 : nat; durationDays = 1 : nat64})' --identity default)"

check "over-long duration rejected" "between 1 and 365" \
    "$(dfx canister call crowdfund createCampaign \
        '(record {title = "t"; description = "d"; goalAmount = 1 : nat; durationDays = 400 : nat64})' --identity default)"

check "unknown campaign reports not found" "CampaignNotFound" \
    "$(dfx canister call crowdfund getCampaign '("999")')"

check "listContributions on unknown campaign reports not found" "CampaignNotFound" \
    "$(dfx canister call crowdfund listContributions '("999")')"

echo
echo "=== $PASS passed, $FAIL failed ==="
[[ $FAIL -eq 0 ]]
