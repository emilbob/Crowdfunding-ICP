import type { Identity } from '@icp-sdk/core/agent';
import { Principal } from '@icp-sdk/core/principal';

import type { CrowdfundService } from './actors';
import type { Account, LedgerService } from './icrc';

/**
 * An in-memory stand-in for the canister and its ledger.
 *
 * It deliberately mirrors the canister's real rules — contributions capped at
 * the remaining need, one-shot withdrawal, refunds only on an expired campaign
 * below goal, deletion refused while funds are held — so the demo behaves like
 * the real thing rather than merely looking like it. What it does not model is
 * consensus: there is no concurrency here, which is exactly why the real
 * guarantees are proven by test/concurrency.sh against a live replica instead.
 */

const DECIMALS = 8;
const SYMBOL = 'DEMO';
const FEE = 10_000n;
const UNIT = 10n ** BigInt(DECIMALS);
const NANOS_PER_DAY = 24n * 60n * 60n * 1_000_000_000n;

function principalFrom(seed: number): Principal {
    return Principal.fromUint8Array(
        Uint8Array.from([seed, 9, 8, 7, 6, 5, 4, 3, 2])
    );
}

export const DEMO_USER = principalFrom(1);
const ALICE = principalFrom(2);
const BOB = principalFrom(3);

const nowNanos = () => BigInt(Date.now()) * 1_000_000n;

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

type Contribution = {
    contributor: Principal;
    amount: bigint;
    timestamp: bigint;
    refunded: boolean;
};

/** Network latency, so busy states and disabled buttons are actually visible. */
const settle = <T,>(value: T, ms = 420): Promise<T> =>
    new Promise((resolve) => setTimeout(() => resolve(value), ms));

function seed(): { campaigns: Campaign[]; contributions: Map<string, Contribution[]> } {
    const now = nowNanos();
    const campaigns: Campaign[] = [
        {
            id: '0',
            title: 'Repair café tool wall',
            description:
                'A wall of shared tools for the neighbourhood repair café: soldering stations, a bench vice, and a full metric socket set.',
            goalAmount: 10n * UNIT,
            currentAmount: 64n * UNIT / 10n,
            startDate: now - 6n * NANOS_PER_DAY,
            endDate: now + 24n * NANOS_PER_DAY,
            owner: ALICE,
            withdrawn: false
        },
        {
            id: '1',
            title: 'Community darkroom',
            description:
                'Fitting out a shared analogue darkroom: enlargers, tanks, ventilation and a light-tight door.',
            goalAmount: 4n * UNIT,
            currentAmount: 4n * UNIT,
            startDate: now - 11n * NANOS_PER_DAY,
            endDate: now + 3n * NANOS_PER_DAY,
            owner: DEMO_USER,
            withdrawn: false
        },
        {
            id: '2',
            title: 'Winter coat drive',
            description:
                'Bulk-buying insulated coats for the shelter before the cold sets in. Did not reach its goal in time.',
            goalAmount: 12n * UNIT,
            currentAmount: 35n * UNIT / 10n,
            startDate: now - 40n * NANOS_PER_DAY,
            endDate: now - 2n * NANOS_PER_DAY,
            owner: BOB,
            withdrawn: false
        },
        {
            id: '3',
            title: 'Library seed bank',
            description:
                'Cabinets, envelopes and a catalogue for a lending seed bank at the public library. Funded and paid out.',
            goalAmount: 2n * UNIT,
            currentAmount: 2n * UNIT,
            startDate: now - 30n * NANOS_PER_DAY,
            endDate: now - 5n * NANOS_PER_DAY,
            owner: ALICE,
            withdrawn: true
        }
    ];

    const contributions = new Map<string, Contribution[]>([
        [
            '0',
            [
                { contributor: BOB, amount: 4n * UNIT, timestamp: now - 5n * NANOS_PER_DAY, refunded: false },
                { contributor: ALICE, amount: 24n * UNIT / 10n, timestamp: now - 3n * NANOS_PER_DAY, refunded: false }
            ]
        ],
        ['1', [{ contributor: BOB, amount: 4n * UNIT, timestamp: now - 8n * NANOS_PER_DAY, refunded: false }]],
        ['2', [{ contributor: DEMO_USER, amount: 35n * UNIT / 10n, timestamp: now - 20n * NANOS_PER_DAY, refunded: false }]],
        ['3', [{ contributor: BOB, amount: 2n * UNIT, timestamp: now - 20n * NANOS_PER_DAY, refunded: false }]]
    ]);

    return { campaigns, contributions };
}

const state = seed();
let nextId = 4;
let balance = 50n * UNIT;
let allowance = 0n;

function find(id: string): Campaign | undefined {
    return state.campaigns.find((c) => c.id === id);
}

const notFound = (id: string) => ({
    Err: { CampaignNotFound: `Campaign with id=${id} not found` }
});

export function demoCrowdfundActor(): CrowdfundService {
    const api = {
        getLedger: async () => settle(principalFrom(42)),

        getCampaigns: async () => settle({ Ok: [...state.campaigns] }),

        getCampaign: async (id: string) => {
            const c = find(id);
            return settle(c ? { Ok: { ...c } } : notFound(id));
        },

        listContributions: async (id: string) => {
            if (!find(id)) return settle(notFound(id));
            return settle({ Ok: [...(state.contributions.get(id) ?? [])] });
        },

        createCampaign: async (payload: {
            title: string;
            description: string;
            goalAmount: bigint;
            durationDays: bigint;
        }) => {
            if (!payload.title || !payload.description) {
                return settle({
                    Err: {
                        ValidationError:
                            'Invalid input data: title and description must be present.'
                    }
                });
            }
            if (payload.goalAmount <= 0n) {
                return settle({ Err: { ValidationError: 'Goal amount must be positive.' } });
            }
            if (payload.durationDays <= 0n || payload.durationDays > 365n) {
                return settle({
                    Err: { ValidationError: 'Duration must be between 1 and 365 days.' }
                });
            }

            const id = String(nextId++);
            const start = nowNanos();
            state.campaigns.push({
                id,
                title: payload.title,
                description: payload.description,
                goalAmount: payload.goalAmount,
                currentAmount: 0n,
                startDate: start,
                endDate: start + payload.durationDays * NANOS_PER_DAY,
                owner: DEMO_USER,
                withdrawn: false
            });
            return settle({ Ok: id });
        },

        contribute: async (id: string, amount: bigint) => {
            const c = find(id);
            if (!c) return settle(notFound(id));
            if (amount <= 0n) {
                return settle({
                    Err: { ValidationError: 'Contribution amount must be positive.' }
                });
            }
            if (c.withdrawn) {
                return settle({
                    Err: {
                        ContributionError: `Campaign with id=${id} has been settled and no longer accepts contributions.`
                    }
                });
            }
            if (nowNanos() > c.endDate) {
                return settle({ Err: { ValidationError: 'This campaign has already ended.' } });
            }

            const remaining = c.goalAmount - c.currentAmount;
            if (remaining <= 0n) {
                return settle({
                    Err: {
                        ContributionError: `Campaign with id=${id} has successfully reached its funding goal. No further contributions are needed.`
                    }
                });
            }

            const accepted = amount > remaining ? remaining : amount;

            // Mirrors icrc2_transfer_from: the allowance must cover amount + fee.
            if (allowance < accepted + FEE) {
                return settle({
                    Err: {
                        LedgerError: `icrc2_transfer_from rejected: InsufficientAllowance. Check that you approved this canister for at least ${accepted} plus the ledger fee.`
                    }
                });
            }
            if (balance < accepted + FEE) {
                return settle({
                    Err: { LedgerError: 'icrc2_transfer_from rejected: InsufficientFunds' }
                });
            }

            allowance -= accepted + FEE;
            balance -= accepted + FEE;
            c.currentAmount += accepted;
            state.contributions.set(id, [
                ...(state.contributions.get(id) ?? []),
                { contributor: DEMO_USER, amount: accepted, timestamp: nowNanos(), refunded: false }
            ]);

            return settle({
                Ok:
                    accepted < amount
                        ? `Contributed ${accepted} to campaign ${id} (reduced from ${amount}; only ${remaining} was still needed)`
                        : `Contributed ${accepted} to campaign ${id}`
            });
        },

        withdrawFunds: async (id: string) => {
            const c = find(id);
            if (!c) return settle(notFound(id));
            if (c.owner.toText() !== DEMO_USER.toText()) {
                return settle({
                    Err: {
                        AuthorizationError: `Unauthorized access. Caller: ${DEMO_USER.toText()}, Required: ${c.owner.toText()}`
                    }
                });
            }
            if (c.withdrawn) {
                return settle({
                    Err: {
                        ValidationError: 'Funds have already been withdrawn for this campaign.'
                    }
                });
            }
            if (c.currentAmount < c.goalAmount) {
                return settle({
                    Err: {
                        ValidationError:
                            'Cannot withdraw funds as the campaign has not reached its funding goal.'
                    }
                });
            }

            c.withdrawn = true;
            const payout = c.currentAmount - FEE;
            balance += payout;
            return settle({
                Ok: `Withdrew ${payout} for campaign ${id} (${c.currentAmount} raised, ${FEE} ledger fee)`
            });
        },

        refund: async (id: string) => {
            const c = find(id);
            if (!c) return settle(notFound(id));
            if (c.withdrawn) {
                return settle({
                    Err: {
                        ValidationError: 'This campaign has been settled and is not refundable.'
                    }
                });
            }
            if (nowNanos() <= c.endDate) {
                return settle({
                    Err: {
                        ValidationError:
                            'This campaign is still active and is not refundable yet.'
                    }
                });
            }
            if (c.currentAmount >= c.goalAmount) {
                return settle({
                    Err: {
                        ValidationError:
                            'This campaign reached its goal; it awaits withdrawal by its owner rather than refunds.'
                    }
                });
            }

            const list = state.contributions.get(id) ?? [];
            const mine = list.filter(
                (x) => !x.refunded && x.contributor.toText() === DEMO_USER.toText()
            );
            if (mine.length === 0) {
                return settle({
                    Err: {
                        ValidationError:
                            'You have no refundable contributions to this campaign.'
                    }
                });
            }

            const total = mine.reduce((s, x) => s + x.amount, 0n);
            mine.forEach((x) => (x.refunded = true));
            c.currentAmount -= total;
            const payout = total - FEE;
            balance += payout;

            return settle({
                Ok: `Refunded ${payout} for campaign ${id} (${total} contributed, ${FEE} ledger fee)`
            });
        },

        deleteCampaign: async (id: string) => {
            const c = find(id);
            if (!c) return settle(notFound(id));
            if (c.owner.toText() !== DEMO_USER.toText()) {
                return settle({
                    Err: {
                        AuthorizationError: `Unauthorized access. Caller: ${DEMO_USER.toText()}, Required: ${c.owner.toText()}`
                    }
                });
            }
            if (c.currentAmount > 0n && !c.withdrawn) {
                return settle({
                    Err: {
                        ValidationError:
                            'Cannot delete a campaign that is still holding contributions. Withdraw or refund them first.'
                    }
                });
            }

            state.campaigns = state.campaigns.filter((x) => x.id !== id);
            state.contributions.delete(id);
            return settle({ Ok: `Campaign ${id} deleted successfully` });
        }
    };

    // One cast at the boundary: the generated service type wraps each method in
    // ActorMethod, which carries agent-only extras this stand-in has no use for.
    return api as unknown as CrowdfundService;
}

export function demoLedgerActor(): LedgerService {
    return {
        icrc1_symbol: async () => settle(SYMBOL, 120),
        icrc1_decimals: async () => settle(DECIMALS, 120),
        icrc1_fee: async () => settle(FEE, 120),
        icrc1_balance_of: async (account: Account) =>
            settle(account.owner.toText() === DEMO_USER.toText() ? balance : 0n, 120),
        icrc2_approve: async (args) => {
            if (balance < args.amount) {
                return settle({ Err: { InsufficientFunds: { balance } } });
            }
            allowance = args.amount;
            balance -= FEE;
            return settle({ Ok: 1n });
        }
    };
}

/** A signed-out-able fake identity, so sign-in works with no Internet Identity. */
export function demoIdentity(): Identity {
    return {
        getPrincipal: () => DEMO_USER
    } as unknown as Identity;
}

export const demoLedgerMeta = { symbol: SYMBOL, decimals: DECIMALS, fee: FEE };
