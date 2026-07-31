import type { IDL as IDLType } from '@icp-sdk/core/candid';
import type { Principal } from '@icp-sdk/core/principal';

export type Account = {
    owner: Principal;
    subaccount: [] | [Uint8Array];
};

export type ApproveResult =
    | { Ok: bigint }
    | { Err: Record<string, unknown> };

export interface LedgerService {
    icrc1_balance_of: (account: Account) => Promise<bigint>;
    icrc1_fee: () => Promise<bigint>;
    icrc1_symbol: () => Promise<string>;
    icrc1_decimals: () => Promise<number>;
    icrc2_approve: (args: {
        fee: [] | [bigint];
        memo: [] | [Uint8Array];
        from_subaccount: [] | [Uint8Array];
        created_at_time: [] | [bigint];
        amount: bigint;
        expected_allowance: [] | [bigint];
        expires_at: [] | [bigint];
        spender: Account;
    }) => Promise<ApproveResult>;
}

// Only the handful of ICRC-1/ICRC-2 methods this UI needs, rather than the
// ledger's full ~640-line Candid interface.
export const ledgerIdlFactory: IDLType.InterfaceFactory = ({ IDL }) => {
    const Account = IDL.Record({
        owner: IDL.Principal,
        subaccount: IDL.Opt(IDL.Vec(IDL.Nat8))
    });

    const ApproveArgs = IDL.Record({
        fee: IDL.Opt(IDL.Nat),
        memo: IDL.Opt(IDL.Vec(IDL.Nat8)),
        from_subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
        created_at_time: IDL.Opt(IDL.Nat64),
        amount: IDL.Nat,
        expected_allowance: IDL.Opt(IDL.Nat),
        expires_at: IDL.Opt(IDL.Nat64),
        spender: Account
    });

    const ApproveError = IDL.Variant({
        GenericError: IDL.Record({ message: IDL.Text, error_code: IDL.Nat }),
        TemporarilyUnavailable: IDL.Null,
        Duplicate: IDL.Record({ duplicate_of: IDL.Nat }),
        BadFee: IDL.Record({ expected_fee: IDL.Nat }),
        AllowanceChanged: IDL.Record({ current_allowance: IDL.Nat }),
        CreatedInFuture: IDL.Record({ ledger_time: IDL.Nat64 }),
        TooOld: IDL.Null,
        Expired: IDL.Record({ ledger_time: IDL.Nat64 }),
        InsufficientFunds: IDL.Record({ balance: IDL.Nat })
    });

    return IDL.Service({
        icrc1_balance_of: IDL.Func([Account], [IDL.Nat], ['query']),
        icrc1_fee: IDL.Func([], [IDL.Nat], ['query']),
        icrc1_symbol: IDL.Func([], [IDL.Text], ['query']),
        icrc1_decimals: IDL.Func([], [IDL.Nat8], ['query']),
        icrc2_approve: IDL.Func(
            [ApproveArgs],
            [IDL.Variant({ Ok: IDL.Nat, Err: ApproveError })],
            []
        )
    });
};

/** Turns an ICRC error variant into something a person can read. */
export function describeIcrcError(err: Record<string, unknown>): string {
    const [name, detail] = Object.entries(err)[0] ?? ['UnknownError', null];
    if (detail && typeof detail === 'object') {
        const inner = Object.entries(detail as Record<string, unknown>)
            .map(([k, v]) => `${k}: ${String(v)}`)
            .join(', ');
        return inner ? `${name} (${inner})` : name;
    }
    return name;
}
