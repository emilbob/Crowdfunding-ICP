import { Actor, HttpAgent, type Identity } from '@icp-sdk/core/agent';
import { Principal } from '@icp-sdk/core/principal';

import { idlFactory as crowdfundIdlFactory } from '@declarations/crowdfund/crowdfund.did.js';
import type { _SERVICE as CrowdfundService } from '@declarations/crowdfund/crowdfund.did';

import { crowdfundCanisterId, host, isLocalReplica } from './canisters';
import { ledgerIdlFactory, type LedgerService } from './icrc';

export type { CrowdfundService };

async function makeAgent(identity?: Identity): Promise<HttpAgent> {
    const agent = await HttpAgent.create({ host, identity });

    // A local replica signs with a throwaway root key, so the agent has to be
    // told to trust it. Never do this against the real IC — which includes the
    // playground, whose canisters run on mainnet.
    if (isLocalReplica) {
        await agent.fetchRootKey();
    }

    return agent;
}

export async function crowdfundActor(
    identity?: Identity
): Promise<CrowdfundService> {
    const agent = await makeAgent(identity);
    return Actor.createActor<CrowdfundService>(crowdfundIdlFactory, {
        agent,
        canisterId: crowdfundCanisterId()
    });
}

export async function ledgerActor(
    ledgerId: Principal,
    identity?: Identity
): Promise<LedgerService> {
    const agent = await makeAgent(identity);
    return Actor.createActor<LedgerService>(ledgerIdlFactory, {
        agent,
        canisterId: ledgerId
    });
}

export { Principal };
