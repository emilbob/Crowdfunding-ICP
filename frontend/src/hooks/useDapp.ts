import type { Identity } from '@icp-sdk/core/agent';
import { Principal } from '@icp-sdk/core/principal';
import { useCallback, useEffect, useState } from 'react';

import { crowdfundActor, ledgerActor } from '../lib/actors';
import * as auth from '../lib/auth';
import { crowdfundCanisterId } from '../lib/canisters';
import { describeIcrcError } from '../lib/icrc';
import { unwrap } from '../lib/format';

export type Campaign = {
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

export type Contribution = {
    contributor: Principal;
    amount: bigint;
    timestamp: bigint;
    refunded: boolean;
};

export type LedgerInfo = {
    id: Principal;
    symbol: string;
    decimals: number;
    fee: bigint;
};

export type Notice = {
    tone: 'success' | 'error' | 'info';
    message: string;
};

export function useDapp() {
    const [identity, setIdentity] = useState<Identity | null>(null);
    const [ledger, setLedger] = useState<LedgerInfo | null>(null);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [balance, setBalance] = useState<bigint | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [notice, setNotice] = useState<Notice | null>(null);
    const [loading, setLoading] = useState(true);

    const principal = identity?.getPrincipal() ?? null;

    const report = useCallback((tone: Notice['tone'], message: string) => {
        setNotice({ tone, message });
    }, []);

    const fail = useCallback(
        (error: unknown, prefix: string) => {
            const message =
                error instanceof Error ? error.message : String(error);
            setNotice({ tone: 'error', message: `${prefix}: ${message}` });
        },
        []
    );

    /** Campaign list is public, so it loads without a signed-in identity. */
    const refreshCampaigns = useCallback(async () => {
        try {
            const actor = await crowdfundActor(identity ?? undefined);
            setCampaigns(unwrap(await actor.getCampaigns()) as Campaign[]);
        } catch (error) {
            fail(error, 'Could not load campaigns');
        }
    }, [identity, fail]);

    const refreshBalance = useCallback(async () => {
        if (!ledger || !principal) {
            setBalance(null);
            return;
        }
        try {
            const actor = await ledgerActor(ledger.id, identity ?? undefined);
            setBalance(
                await actor.icrc1_balance_of({
                    owner: principal,
                    subaccount: []
                })
            );
        } catch {
            setBalance(null);
        }
    }, [ledger, principal, identity]);

    // Restore any existing session, then discover which ledger the canister
    // settles against and read its metadata.
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const restored = await auth.currentIdentity();
                if (cancelled) return;
                setIdentity(restored);

                const actor = await crowdfundActor(restored ?? undefined);
                const ledgerId = await actor.getLedger();
                const ledgerA = await ledgerActor(
                    ledgerId,
                    restored ?? undefined
                );

                const [symbol, decimals, fee] = await Promise.all([
                    ledgerA.icrc1_symbol(),
                    ledgerA.icrc1_decimals(),
                    ledgerA.icrc1_fee()
                ]);

                if (cancelled) return;
                setLedger({ id: ledgerId, symbol, decimals: Number(decimals), fee });
            } catch (error) {
                if (!cancelled) fail(error, 'Could not reach the canister');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [fail]);

    useEffect(() => {
        void refreshCampaigns();
    }, [refreshCampaigns]);

    useEffect(() => {
        void refreshBalance();
    }, [refreshBalance]);

    const signIn = useCallback(async () => {
        setBusy('signin');
        try {
            setIdentity(await auth.signIn());
            setNotice(null);
        } catch (error) {
            fail(error, 'Sign-in failed');
        } finally {
            setBusy(null);
        }
    }, [fail]);

    const signOut = useCallback(async () => {
        await auth.signOut();
        setIdentity(null);
        setBalance(null);
    }, []);

    const createCampaign = useCallback(
        async (input: {
            title: string;
            description: string;
            goalAmount: bigint;
            durationDays: bigint;
        }) => {
            setBusy('create');
            try {
                const actor = await crowdfundActor(identity ?? undefined);
                const id = unwrap(await actor.createCampaign(input));
                report('success', `Campaign #${id} created.`);
                await refreshCampaigns();
                return true;
            } catch (error) {
                fail(error, 'Could not create campaign');
                return false;
            } finally {
                setBusy(null);
            }
        },
        [identity, refreshCampaigns, report, fail]
    );

    /**
     * Contributing is two transactions. The ledger has to be told this canister
     * may move tokens on the backer's behalf (icrc2_approve) before the
     * canister can pull them (icrc2_transfer_from) — and the allowance must
     * cover the ledger's own fee on top of the contribution.
     */
    const contribute = useCallback(
        async (campaignId: string, amount: bigint) => {
            if (!ledger || !identity) return false;

            setBusy(`contribute:${campaignId}`);
            try {
                const ledgerA = await ledgerActor(ledger.id, identity);
                const approval = await ledgerA.icrc2_approve({
                    fee: [],
                    memo: [],
                    from_subaccount: [],
                    created_at_time: [],
                    amount: amount + ledger.fee,
                    expected_allowance: [],
                    expires_at: [],
                    spender: {
                        owner: Principal.fromText(crowdfundCanisterId()),
                        subaccount: []
                    }
                });

                if ('Err' in approval) {
                    throw new Error(
                        `approval rejected — ${describeIcrcError(approval.Err)}`
                    );
                }

                const actor = await crowdfundActor(identity);
                report('success', unwrap(await actor.contribute(campaignId, amount)));

                await Promise.all([refreshCampaigns(), refreshBalance()]);
                return true;
            } catch (error) {
                fail(error, 'Contribution failed');
                return false;
            } finally {
                setBusy(null);
            }
        },
        [ledger, identity, refreshCampaigns, refreshBalance, report, fail]
    );

    const campaignAction = useCallback(
        async (
            method: 'withdrawFunds' | 'refund' | 'deleteCampaign',
            campaignId: string,
            label: string
        ) => {
            setBusy(`${method}:${campaignId}`);
            try {
                const actor = await crowdfundActor(identity ?? undefined);
                report('success', unwrap(await actor[method](campaignId)));
                await Promise.all([refreshCampaigns(), refreshBalance()]);
                return true;
            } catch (error) {
                fail(error, `${label} failed`);
                return false;
            } finally {
                setBusy(null);
            }
        },
        [identity, refreshCampaigns, refreshBalance, report, fail]
    );

    const listContributions = useCallback(
        async (campaignId: string): Promise<Contribution[]> => {
            const actor = await crowdfundActor(identity ?? undefined);
            return unwrap(
                await actor.listContributions(campaignId)
            ) as Contribution[];
        },
        [identity]
    );

    return {
        loading,
        identity,
        principal,
        ledger,
        campaigns,
        balance,
        busy,
        notice,
        dismissNotice: () => setNotice(null),
        signIn,
        signOut,
        createCampaign,
        contribute,
        listContributions,
        withdraw: (id: string) =>
            campaignAction('withdrawFunds', id, 'Withdrawal'),
        refund: (id: string) => campaignAction('refund', id, 'Refund'),
        remove: (id: string) => campaignAction('deleteCampaign', id, 'Delete')
    };
}
