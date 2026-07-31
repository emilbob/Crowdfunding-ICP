import { useState } from 'react';

import type { LedgerInfo } from '../hooks/useDapp';
import { parseTokens } from '../lib/format';

type Props = {
    ledger: LedgerInfo;
    busy: string | null;
    onCreate: (input: {
        title: string;
        description: string;
        goalAmount: bigint;
        durationDays: bigint;
    }) => Promise<boolean>;
};

const FIELD =
    'mt-1.5 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none transition focus:border-accent';
const LABEL = 'text-[11px] font-medium uppercase tracking-wider text-muted';

export function CreateCampaignForm({ ledger, busy, onCreate }: Props) {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [goal, setGoal] = useState('');
    const [days, setDays] = useState('30');
    const [error, setError] = useState<string | null>(null);

    function reset() {
        setTitle('');
        setDescription('');
        setGoal('');
        setDays('30');
        setError(null);
    }

    async function submit(event: React.FormEvent) {
        event.preventDefault();

        // Mirrors the canister's own validation so the failure is immediate
        // rather than a round-trip away.
        if (!title.trim() || !description.trim()) {
            setError('Title and description are both required.');
            return;
        }

        const goalAmount = parseTokens(goal, ledger.decimals);
        if (goalAmount === null || goalAmount <= 0n) {
            setError(
                `Goal must be a positive amount with at most ${ledger.decimals} decimal places.`
            );
            return;
        }

        const duration = Number(days);
        if (!Number.isInteger(duration) || duration < 1 || duration > 365) {
            setError('Duration must be a whole number of days, from 1 to 365.');
            return;
        }

        setError(null);
        const created = await onCreate({
            title: title.trim(),
            description: description.trim(),
            goalAmount,
            durationDays: BigInt(duration)
        });

        if (created) {
            reset();
            setOpen(false);
        }
    }

    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                className="group inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-on-accent transition hover:opacity-90 active:scale-[0.98]"
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    className="size-4 transition-transform group-hover:rotate-90"
                    aria-hidden="true"
                >
                    <path d="M12 5.5v13M5.5 12h13" />
                </svg>
                Start a campaign
            </button>
        );
    }

    return (
        <form
            onSubmit={submit}
            className="rise themed rounded-xl border border-line bg-surface p-5"
        >
            <h2 className="text-[15px] font-semibold tracking-tight">
                Start a campaign
            </h2>
            <p className="mt-1 text-xs text-muted">
                You become the owner and can withdraw once the goal is reached.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                    <span className={LABEL}>Title</span>
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={100}
                        className={FIELD}
                        placeholder="What are you raising for?"
                    />
                </label>

                <label className="sm:col-span-2">
                    <span className={LABEL}>Description</span>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        maxLength={600}
                        className={`${FIELD} resize-y`}
                        placeholder="What will the funds be used for?"
                    />
                </label>

                <label>
                    <span className={LABEL}>Goal</span>
                    <div className="relative">
                        <input
                            value={goal}
                            onChange={(e) => setGoal(e.target.value)}
                            inputMode="decimal"
                            placeholder="0.00"
                            className={`tnum ${FIELD} pr-14`}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted">
                            {ledger.symbol}
                        </span>
                    </div>
                </label>

                <label>
                    <span className={LABEL}>Duration</span>
                    <div className="relative">
                        <input
                            value={days}
                            onChange={(e) => setDays(e.target.value)}
                            inputMode="numeric"
                            className={`tnum ${FIELD} pr-14`}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted">
                            days
                        </span>
                    </div>
                </label>
            </div>

            {error && <p className="mt-3 text-xs text-danger">{error}</p>}

            <div className="mt-5 flex gap-2">
                <button
                    type="submit"
                    disabled={busy !== null}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                >
                    {busy === 'create' ? 'Creating…' : 'Create campaign'}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        reset();
                        setOpen(false);
                    }}
                    className="rounded-lg border border-line px-4 py-2 text-sm transition hover:bg-raised"
                >
                    Cancel
                </button>
            </div>
        </form>
    );
}
