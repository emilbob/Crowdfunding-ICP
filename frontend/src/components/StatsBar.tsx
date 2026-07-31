import type { Campaign, LedgerInfo } from '../hooks/useDapp';
import { campaignState, formatTokens } from '../lib/format';

type Props = {
    campaigns: Campaign[];
    ledger: LedgerInfo;
};

export function StatsBar({ campaigns, ledger }: Props) {
    const raised = campaigns.reduce((sum, c) => sum + c.currentAmount, 0n);
    const open = campaigns.filter((c) => campaignState(c) === 'open').length;
    const funded = campaigns.filter((c) => {
        const state = campaignState(c);
        return state === 'goal-reached' || state === 'settled';
    }).length;

    const stats: Array<{ label: string; value: string; accent?: boolean }> = [
        {
            label: 'Total raised',
            value: formatTokens(raised, ledger.decimals, ledger.symbol),
            accent: true
        },
        { label: 'Open now', value: String(open) },
        { label: 'Funded', value: String(funded) },
        { label: 'Campaigns', value: String(campaigns.length) }
    ];

    return (
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
            {stats.map(({ label, value, accent }) => (
                <div key={label} className="bg-surface px-4 py-3.5">
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-muted">
                        {label}
                    </dt>
                    <dd
                        className={`tnum mt-1 truncate text-lg font-semibold ${
                            accent ? 'text-accent' : 'text-ink'
                        }`}
                        title={value}
                    >
                        {value}
                    </dd>
                </div>
            ))}
        </dl>
    );
}
