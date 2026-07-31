/** Token amounts are integers in the ledger's smallest unit. */
export function formatTokens(
    amount: bigint,
    decimals: number,
    symbol: string
): string {
    if (decimals === 0) {
        return `${amount.toLocaleString()} ${symbol}`;
    }

    const scale = 10n ** BigInt(decimals);
    const whole = amount / scale;
    const fraction = amount % scale;

    if (fraction === 0n) {
        return `${whole.toLocaleString()} ${symbol}`;
    }

    // Trim trailing zeros but keep at least two places for readability.
    const padded = fraction.toString().padStart(decimals, '0');
    const trimmed = padded.replace(/0+$/, '').padEnd(2, '0');

    return `${whole.toLocaleString()}.${trimmed} ${symbol}`;
}

/** Parses a human amount ("1.25") into the ledger's smallest unit. */
export function parseTokens(input: string, decimals: number): bigint | null {
    const trimmed = input.trim();
    if (!/^\d+(\.\d+)?$/.test(trimmed)) {
        return null;
    }

    const [whole, fraction = ''] = trimmed.split('.');
    if (fraction.length > decimals) {
        return null;
    }

    return (
        BigInt(whole) * 10n ** BigInt(decimals) +
        BigInt(fraction.padEnd(decimals, '0') || '0')
    );
}

/** IC timestamps are nanoseconds since the epoch. */
export function nanosToDate(nanos: bigint): Date {
    return new Date(Number(nanos / 1_000_000n));
}

export function formatDate(nanos: bigint): string {
    return nanosToDate(nanos).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
}

export function timeRemaining(endDate: bigint): string {
    const ms = nanosToDate(endDate).getTime() - Date.now();
    if (ms <= 0) {
        return 'ended';
    }

    const minutes = Math.floor(ms / 60_000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h left`;
    if (hours > 0) return `${hours}h ${minutes % 60}m left`;
    return `${Math.max(minutes, 1)}m left`;
}

export function shortPrincipal(text: string): string {
    return text.length <= 16 ? text : `${text.slice(0, 6)}…${text.slice(-4)}`;
}

export type CampaignState = 'open' | 'goal-reached' | 'settled' | 'expired';

export function campaignState(c: {
    currentAmount: bigint;
    goalAmount: bigint;
    endDate: bigint;
    withdrawn: boolean;
}): CampaignState {
    if (c.withdrawn) return 'settled';
    if (c.currentAmount >= c.goalAmount) return 'goal-reached';
    if (nanosToDate(c.endDate).getTime() <= Date.now()) return 'expired';
    return 'open';
}

/** Unwraps the canister's `{ Ok } | { Err }` result into a value or throws. */
export function unwrap<T>(result: { Ok: T } | { Err: Record<string, string> }): T {
    if ('Ok' in result) {
        return result.Ok;
    }
    const [kind, message] = Object.entries(result.Err)[0] ?? [
        'Error',
        'Unknown error'
    ];
    throw new Error(`${kind}: ${message}`);
}
