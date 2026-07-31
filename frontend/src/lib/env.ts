/**
 * Demo mode swaps the canister and ledger actors for an in-memory backend, so
 * the app can be hosted as a plain static site with no replica behind it.
 *
 * Everything above the actor boundary — useDapp, every component, the two-step
 * approve/contribute flow, the state machine — runs unchanged. Only the network
 * edge is faked, so the demo exercises the real code rather than a mock of it.
 */
export const isDemo = import.meta.env.VITE_DEMO === '1';
