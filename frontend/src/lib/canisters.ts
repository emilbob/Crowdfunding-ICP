declare const __CANISTER_IDS__: Record<string, string>;
declare const __DFX_NETWORK__: string;

export const network = __DFX_NETWORK__;
export const isMainnet = network === 'ic';

const ids = __CANISTER_IDS__;

function required(name: string): string {
    const id = ids[name];
    if (!id) {
        throw new Error(
            `Canister id for "${name}" is missing. Run \`dfx deploy\` and rebuild the frontend.`
        );
    }
    return id;
}

export const crowdfundCanisterId = (): string => required('crowdfund');

export const internetIdentityCanisterId = (): string | undefined =>
    ids['internet_identity'];

/** The replica/gateway the agent talks to. Same origin in both dev and prod. */
export const host = window.location.origin;

/**
 * Where the II window points. On mainnet that is the real Internet Identity;
 * locally it is whichever II canister dfx deployed, addressed via the
 * <canister-id>.localhost form so the replica routes it correctly.
 *
 * The `#authorize` suffix is required. AuthClient uses this URL verbatim — it
 * does not append an authorize route the way the old @dfinity/auth-client did
 * (note its own default is the fully-qualified `https://id.ai/authorize`).
 * Passing a bare origin just loads Internet Identity's management SPA, which
 * lands on /manage and never starts the delegation flow.
 */
export function identityProvider(): string {
    if (isMainnet) {
        return 'https://identity.ic0.app/#authorize';
    }
    const local = internetIdentityCanisterId();
    if (!local) {
        throw new Error(
            'No local internet_identity canister. Run `npm run setup:local` then `dfx deploy`.'
        );
    }
    return `http://${local}.localhost:4943/#authorize`;
}
