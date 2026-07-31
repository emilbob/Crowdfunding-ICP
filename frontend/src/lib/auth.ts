import { AuthClient } from '@icp-sdk/auth/client';
import type { Identity } from '@icp-sdk/core/agent';

import { identityProvider } from './canisters';
import { demoIdentity } from './demo';
import { isDemo } from './env';

// Eight hours, in nanoseconds.
const SESSION_LIFETIME = 8n * 3_600_000_000_000n;

let client: AuthClient | null = null;

async function getClient(): Promise<AuthClient> {
    if (client === null) {
        client = new AuthClient({ identityProvider: identityProvider() });
    }
    return client;
}

/**
 * The signed-in identity, or null. Note this always goes through
 * `getIdentity()` rather than the synchronous `isAuthenticated()`, because on a
 * cold page load the session still has to be restored from storage — checking
 * the flag first would report "signed out" for an existing session.
 */
let demoSignedIn = false;

export async function currentIdentity(): Promise<Identity | null> {
    if (isDemo) {
        return demoSignedIn ? demoIdentity() : null;
    }
    const identity = await (await getClient()).getIdentity();
    return identity.getPrincipal().isAnonymous() ? null : identity;
}

export async function signIn(): Promise<Identity> {
    if (isDemo) {
        demoSignedIn = true;
        return demoIdentity();
    }
    return (await getClient()).signIn({ maxTimeToLive: SESSION_LIFETIME });
}

export async function signOut(): Promise<void> {
    if (isDemo) {
        demoSignedIn = false;
        return;
    }
    await (await getClient()).signOut();
    // Drop the cached client so the next sign-in starts from a clean session.
    client = null;
}
