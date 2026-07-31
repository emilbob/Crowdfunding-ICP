import {
    call,
    canisterSelf,
    IDL,
    init,
    msgCaller,
    Principal,
    query,
    StableBTreeMap,
    time,
    trap,
    update
} from 'azle';
import { TransferArgs, TransferResult } from 'azle/canisters/icrc_1/idl';
import {
    TransferFromArgs,
    TransferFromResult
} from 'azle/canisters/icrc_2/idl';

// CONCURRENCY NOTE
// Every `await` on an inter-canister call is a commit point: the canister's
// state is written to the replica and other messages run before the response
// arrives. So any check performed before an await is stale by the time it
// resolves. The pattern used throughout this file is to mutate state
// *synchronously* first (reserving a contribution, flagging a withdrawal),
// then call the ledger, then undo that mutation if the call fails. State read
// back after an await is always re-read from stable memory, never reused.

const CampaignPayload = IDL.Record({
    title: IDL.Text,
    description: IDL.Text,
    goalAmount: IDL.Nat,
    durationDays: IDL.Nat64
});
type CampaignPayload = {
    title: string;
    description: string;
    goalAmount: bigint;
    durationDays: bigint;
};

const Campaign = IDL.Record({
    id: IDL.Text,
    title: IDL.Text,
    description: IDL.Text,
    goalAmount: IDL.Nat,
    currentAmount: IDL.Nat,
    startDate: IDL.Nat64,
    endDate: IDL.Nat64,
    owner: IDL.Principal,
    withdrawn: IDL.Bool
});
type Campaign = {
    id: string;
    title: string;
    description: string;
    goalAmount: bigint;
    currentAmount: bigint;
    startDate: bigint;
    endDate: bigint;
    owner: Principal;
    withdrawn: boolean;
};

const Contribution = IDL.Record({
    contributor: IDL.Principal,
    amount: IDL.Nat,
    timestamp: IDL.Nat64,
    refunded: IDL.Bool
});
type Contribution = {
    contributor: Principal;
    amount: bigint;
    timestamp: bigint;
    refunded: boolean;
};

const CrowdfundError = IDL.Variant({
    CampaignNotFound: IDL.Text,
    ContributionError: IDL.Text,
    AuthorizationError: IDL.Text,
    ValidationError: IDL.Text,
    LedgerError: IDL.Text
});
type CrowdfundError =
    | { CampaignNotFound: string }
    | { ContributionError: string }
    | { AuthorizationError: string }
    | { ValidationError: string }
    | { LedgerError: string };

type Result<T> = { Ok: T } | { Err: CrowdfundError };

function ResultOf(okType: IDL.Type): IDL.Type {
    return IDL.Variant({ Ok: okType, Err: CrowdfundError });
}

const ResultText = ResultOf(IDL.Text);
const ResultCampaign = ResultOf(Campaign);
const ResultCampaigns = ResultOf(IDL.Vec(Campaign));
const ResultContributions = ResultOf(IDL.Vec(Contribution));

const campaignsStorage = new StableBTreeMap<string, Campaign>(0);
const contributionsStorage = new StableBTreeMap<string, Contribution[]>(1);
// Configuration and the campaign-id counter. Kept in stable memory so both
// survive upgrades; a class field would not.
const configStorage = new StableBTreeMap<string, string>(2);

const LEDGER_KEY = 'ledger';
const NEXT_ID_KEY = 'nextCampaignId';

const NANOS_PER_DAY = 24n * 60n * 60n * 1_000_000_000n;
const MAX_DURATION_DAYS = 365n;

/**
 * Helper functions
 */

function ledgerId(): Principal {
    const stored = configStorage.get(LEDGER_KEY);
    if (stored === undefined) {
        trap('Canister has not been initialized with a ledger canister id');
    }
    return Principal.fromText(stored);
}

// Campaign ids come from a stable counter rather than uuid v4. Azle seeds its
// Math.random deterministically, so v4 ids are predictable on ICP and can
// collide; a counter is both cheaper and actually unique.
function nextCampaignId(): string {
    const current = BigInt(configStorage.get(NEXT_ID_KEY) ?? '0');
    configStorage.insert(NEXT_ID_KEY, (current + 1n).toString());
    return current.toString();
}

function campaignNotFound(campaignId: string): Result<never> {
    return { Err: { CampaignNotFound: `Campaign with id=${campaignId} not found` } };
}

function validationError(message: string): Result<never> {
    return { Err: { ValidationError: message } };
}

function ledgerError(message: string): Result<never> {
    return { Err: { LedgerError: message } };
}

function describeLedgerError(error: object): string {
    const [variant] = Object.keys(error);
    return variant ?? 'UnknownLedgerError';
}

function contributionsOf(campaignId: string): Contribution[] {
    return contributionsStorage.get(campaignId) ?? [];
}

async function ledgerFee(): Promise<bigint> {
    return await call<[], bigint>(ledgerId(), 'icrc1_fee', {
        paramIdlTypes: [],
        args: [],
        returnIdlType: IDL.Nat
    });
}

// Undo a synchronous reservation after a failed ledger call. Re-reads the
// campaign because it may have changed while the call was in flight.
function releaseAmount(campaignId: string, amount: bigint): void {
    const campaign = campaignsStorage.get(campaignId);
    if (campaign === undefined) {
        return;
    }
    campaign.currentAmount =
        campaign.currentAmount > amount ? campaign.currentAmount - amount : 0n;
    campaignsStorage.insert(campaignId, campaign);
}

// Undo a refund marking after a failed ledger call. Identifies contributions by
// array index, not timestamp: contributions made in the same consensus round
// share a timestamp, so timestamps do not identify a single backer's entries.
// Indices are stable because contributions are only ever appended.
function restoreRefunded(
    campaignId: string,
    refundedIndices: number[],
    total: bigint
): void {
    const contributions = contributionsOf(campaignId);
    for (const index of refundedIndices) {
        const contribution = contributions[index];
        if (contribution !== undefined) {
            contribution.refunded = false;
        }
    }
    contributionsStorage.insert(campaignId, contributions);

    const campaign = campaignsStorage.get(campaignId);
    if (campaign === undefined) {
        return;
    }
    campaign.currentAmount += total;
    campaignsStorage.insert(campaignId, campaign);
}

export default class {
    /**
     * Initialization
     */

    // The ICRC-1/ICRC-2 ledger this canister settles against, e.g. the ICP
    // ledger. Passed at deploy time:
    //   dfx deploy crowdfund --argument '(principal "ryjl3-tyaaa-aaaaa-aaaba-cai")'
    @init([IDL.Principal])
    init(ledger: Principal): void {
        configStorage.insert(LEDGER_KEY, ledger.toText());
    }

    /**
     * Update methods
     */

    @update([CampaignPayload], ResultText)
    createCampaign(payload: CampaignPayload): Result<string> {
        if (payload.title === '' || payload.description === '') {
            return validationError(
                'Invalid input data: title and description must be present.'
            );
        }
        if (payload.goalAmount <= 0n) {
            return validationError('Goal amount must be positive.');
        }
        if (
            payload.durationDays <= 0n ||
            payload.durationDays > MAX_DURATION_DAYS
        ) {
            return validationError(
                `Duration must be between 1 and ${MAX_DURATION_DAYS} days.`
            );
        }

        const campaignId = nextCampaignId();
        const startDate = time();

        campaignsStorage.insert(campaignId, {
            id: campaignId,
            title: payload.title,
            description: payload.description,
            goalAmount: payload.goalAmount,
            currentAmount: 0n,
            startDate,
            endDate: startDate + payload.durationDays * NANOS_PER_DAY,
            owner: msgCaller(),
            withdrawn: false
        });

        return { Ok: campaignId };
    }

    // Pulls `amount` tokens from the caller into this canister. The caller must
    // first grant this canister an ICRC-2 allowance of at least amount + fee:
    //   dfx canister call <ledger> icrc2_approve '(record { spender = record { owner = principal "<crowdfund>" }; amount = <amount + fee> })'
    @update([IDL.Text, IDL.Nat], ResultText)
    async contribute(
        campaignId: string,
        amount: bigint
    ): Promise<Result<string>> {
        if (amount <= 0n) {
            return validationError('Contribution amount must be positive.');
        }

        const campaign = campaignsStorage.get(campaignId);
        if (campaign === undefined) {
            return campaignNotFound(campaignId);
        }
        if (campaign.withdrawn) {
            return {
                Err: {
                    ContributionError: `Campaign with id=${campaignId} has been settled and no longer accepts contributions.`
                }
            };
        }
        if (time() > campaign.endDate) {
            return validationError('This campaign has already ended.');
        }

        const remaining = campaign.goalAmount - campaign.currentAmount;
        if (remaining <= 0n) {
            return {
                Err: {
                    ContributionError: `Campaign with id=${campaignId} has successfully reached its funding goal. No further contributions are needed.`
                }
            };
        }

        // Cap at what the campaign still needs, so it cannot get stuck short of
        // its goal waiting for an exact-fit contribution.
        const accepted = amount > remaining ? remaining : amount;
        const contributor = msgCaller();

        // Reserve synchronously, before the await, so two concurrent
        // contributions cannot both see the same `remaining` and overshoot.
        campaign.currentAmount += accepted;
        campaignsStorage.insert(campaignId, campaign);

        let transfer: TransferFromResult;
        try {
            transfer = await call<[unknown], TransferFromResult>(
                ledgerId(),
                'icrc2_transfer_from',
                {
                    paramIdlTypes: [TransferFromArgs],
                    args: [
                        {
                            to: { owner: canisterSelf(), subaccount: [] },
                            fee: [],
                            spender_subaccount: [],
                            from: { owner: contributor, subaccount: [] },
                            memo: [],
                            created_at_time: [],
                            amount: accepted
                        }
                    ],
                    returnIdlType: TransferFromResult
                }
            );
        } catch (error) {
            releaseAmount(campaignId, accepted);
            return ledgerError(`icrc2_transfer_from call failed: ${error}`);
        }

        if ('Err' in transfer) {
            releaseAmount(campaignId, accepted);
            return ledgerError(
                `icrc2_transfer_from rejected: ${describeLedgerError(transfer.Err)}. Check that you approved this canister for at least ${accepted} plus the ledger fee.`
            );
        }

        const contributions = contributionsOf(campaignId);
        contributions.push({
            contributor,
            amount: accepted,
            timestamp: time(),
            refunded: false
        });
        contributionsStorage.insert(campaignId, contributions);

        return {
            Ok:
                accepted < amount
                    ? `Contributed ${accepted} to campaign ${campaignId} (reduced from ${amount}; only ${remaining} was still needed)`
                    : `Contributed ${accepted} to campaign ${campaignId}`
        };
    }

    // Owner-only, goal-reached, one-shot. Transfers the raised total (less the
    // ledger fee) to the owner.
    @update([IDL.Text], ResultText)
    async withdrawFunds(campaignId: string): Promise<Result<string>> {
        const campaign = campaignsStorage.get(campaignId);
        if (campaign === undefined) {
            return campaignNotFound(campaignId);
        }

        const caller = msgCaller();
        if (caller.toText() !== campaign.owner.toText()) {
            return {
                Err: {
                    AuthorizationError: `Unauthorized access. Caller: ${caller.toText()}, Required: ${campaign.owner.toText()}`
                }
            };
        }
        if (campaign.withdrawn) {
            return validationError(
                'Funds have already been withdrawn for this campaign.'
            );
        }
        if (campaign.currentAmount < campaign.goalAmount) {
            return validationError(
                'Cannot withdraw funds as the campaign has not reached its funding goal.'
            );
        }

        const raised = campaign.currentAmount;

        // Flag before the await so a second concurrent call cannot also pay out.
        // currentAmount is deliberately preserved as the historical raised total.
        campaign.withdrawn = true;
        campaignsStorage.insert(campaignId, campaign);

        try {
            const fee = await ledgerFee();
            if (raised <= fee) {
                throw new Error(
                    `raised total ${raised} does not cover the ledger fee ${fee}`
                );
            }

            const payout = raised - fee;
            const transfer = await call<[unknown], TransferResult>(
                ledgerId(),
                'icrc1_transfer',
                {
                    paramIdlTypes: [TransferArgs],
                    args: [
                        {
                            to: { owner: campaign.owner, subaccount: [] },
                            fee: [],
                            memo: [],
                            from_subaccount: [],
                            created_at_time: [],
                            amount: payout
                        }
                    ],
                    returnIdlType: TransferResult
                }
            );

            if ('Err' in transfer) {
                throw new Error(describeLedgerError(transfer.Err));
            }

            return {
                Ok: `Withdrew ${payout} for campaign ${campaignId} (${raised} raised, ${fee} ledger fee)`
            };
        } catch (error) {
            const current = campaignsStorage.get(campaignId);
            if (current !== undefined) {
                current.withdrawn = false;
                campaignsStorage.insert(campaignId, current);
            }
            return ledgerError(`Withdrawal failed: ${error}`);
        }
    }

    // Refunds the caller's own contributions once a campaign has expired below
    // its goal. Scoped to the caller so the work stays bounded regardless of how
    // many backers a campaign has.
    @update([IDL.Text], ResultText)
    async refund(campaignId: string): Promise<Result<string>> {
        const campaign = campaignsStorage.get(campaignId);
        if (campaign === undefined) {
            return campaignNotFound(campaignId);
        }
        if (campaign.withdrawn) {
            return validationError(
                'This campaign has been settled and is not refundable.'
            );
        }
        if (time() <= campaign.endDate) {
            return validationError(
                'This campaign is still active and is not refundable yet.'
            );
        }
        if (campaign.currentAmount >= campaign.goalAmount) {
            return validationError(
                'This campaign reached its goal; it awaits withdrawal by its owner rather than refunds.'
            );
        }

        const caller = msgCaller();
        const contributions = contributionsOf(campaignId);
        const refundedIndices: number[] = [];
        let total = 0n;

        contributions.forEach((contribution, index) => {
            if (
                contribution.refunded === false &&
                contribution.contributor.toText() === caller.toText()
            ) {
                contribution.refunded = true;
                refundedIndices.push(index);
                total += contribution.amount;
            }
        });

        if (refundedIndices.length === 0) {
            return validationError(
                'You have no refundable contributions to this campaign.'
            );
        }

        // Mark and debit synchronously so a concurrent refund cannot pay twice.
        contributionsStorage.insert(campaignId, contributions);
        campaign.currentAmount -= total;
        campaignsStorage.insert(campaignId, campaign);

        try {
            const fee = await ledgerFee();
            if (total <= fee) {
                throw new Error(
                    `refundable total ${total} does not cover the ledger fee ${fee}`
                );
            }

            const payout = total - fee;
            const transfer = await call<[unknown], TransferResult>(
                ledgerId(),
                'icrc1_transfer',
                {
                    paramIdlTypes: [TransferArgs],
                    args: [
                        {
                            to: { owner: caller, subaccount: [] },
                            fee: [],
                            memo: [],
                            from_subaccount: [],
                            created_at_time: [],
                            amount: payout
                        }
                    ],
                    returnIdlType: TransferResult
                }
            );

            if ('Err' in transfer) {
                throw new Error(describeLedgerError(transfer.Err));
            }

            return {
                Ok: `Refunded ${payout} for campaign ${campaignId} (${total} contributed, ${fee} ledger fee)`
            };
        } catch (error) {
            restoreRefunded(campaignId, refundedIndices, total);
            return ledgerError(`Refund failed: ${error}`);
        }
    }

    @update([IDL.Text], ResultText)
    deleteCampaign(campaignId: string): Result<string> {
        const campaign = campaignsStorage.get(campaignId);
        if (campaign === undefined) {
            return campaignNotFound(campaignId);
        }

        const caller = msgCaller();
        if (caller.toText() !== campaign.owner.toText()) {
            return {
                Err: {
                    AuthorizationError: `Unauthorized access. Caller: ${caller.toText()}, Required: ${campaign.owner.toText()}`
                }
            };
        }

        // Refuse while the canister still holds this campaign's tokens, which
        // deletion would strand with no way to withdraw or refund them.
        if (campaign.currentAmount > 0n && campaign.withdrawn === false) {
            return validationError(
                'Cannot delete a campaign that is still holding contributions. Withdraw or refund them first.'
            );
        }

        campaignsStorage.remove(campaignId);
        // Remove alongside the campaign, otherwise the entry is orphaned in
        // stable memory and still readable via listContributions.
        contributionsStorage.remove(campaignId);

        return { Ok: `Campaign ${campaignId} deleted successfully` };
    }

    /**
     * Query methods
     */

    @query([IDL.Text], ResultCampaign)
    getCampaign(campaignId: string): Result<Campaign> {
        const campaign = campaignsStorage.get(campaignId);
        if (campaign === undefined) {
            return campaignNotFound(campaignId);
        }
        return { Ok: campaign };
    }

    @query([], ResultCampaigns)
    getCampaigns(): Result<Campaign[]> {
        return { Ok: campaignsStorage.values() };
    }

    @query([IDL.Text], ResultContributions)
    listContributions(campaignId: string): Result<Contribution[]> {
        // A campaign that exists but has no contributions yet is a valid empty
        // list, not a missing campaign.
        if (campaignsStorage.get(campaignId) === undefined) {
            return campaignNotFound(campaignId);
        }
        return { Ok: contributionsOf(campaignId) };
    }

    @query([], IDL.Principal)
    getLedger(): Principal {
        return ledgerId();
    }
}
