export const idlFactory = ({ IDL }) => {
  return IDL.Service({
    'contribute' : IDL.Func(
        [IDL.Text, IDL.Nat],
        [
          IDL.Variant({
            'Ok' : IDL.Text,
            'Err' : IDL.Variant({
              'AuthorizationError' : IDL.Text,
              'ContributionError' : IDL.Text,
              'CampaignNotFound' : IDL.Text,
              'ValidationError' : IDL.Text,
              'LedgerError' : IDL.Text,
            }),
          }),
        ],
        [],
      ),
    'createCampaign' : IDL.Func(
        [
          IDL.Record({
            'durationDays' : IDL.Nat64,
            'title' : IDL.Text,
            'goalAmount' : IDL.Nat,
            'description' : IDL.Text,
          }),
        ],
        [
          IDL.Variant({
            'Ok' : IDL.Text,
            'Err' : IDL.Variant({
              'AuthorizationError' : IDL.Text,
              'ContributionError' : IDL.Text,
              'CampaignNotFound' : IDL.Text,
              'ValidationError' : IDL.Text,
              'LedgerError' : IDL.Text,
            }),
          }),
        ],
        [],
      ),
    'deleteCampaign' : IDL.Func(
        [IDL.Text],
        [
          IDL.Variant({
            'Ok' : IDL.Text,
            'Err' : IDL.Variant({
              'AuthorizationError' : IDL.Text,
              'ContributionError' : IDL.Text,
              'CampaignNotFound' : IDL.Text,
              'ValidationError' : IDL.Text,
              'LedgerError' : IDL.Text,
            }),
          }),
        ],
        [],
      ),
    'getCampaign' : IDL.Func(
        [IDL.Text],
        [
          IDL.Variant({
            'Ok' : IDL.Record({
              'id' : IDL.Text,
              'title' : IDL.Text,
              'goalAmount' : IDL.Nat,
              'endDate' : IDL.Nat64,
              'owner' : IDL.Principal,
              'description' : IDL.Text,
              'currentAmount' : IDL.Nat,
              'withdrawn' : IDL.Bool,
              'startDate' : IDL.Nat64,
            }),
            'Err' : IDL.Variant({
              'AuthorizationError' : IDL.Text,
              'ContributionError' : IDL.Text,
              'CampaignNotFound' : IDL.Text,
              'ValidationError' : IDL.Text,
              'LedgerError' : IDL.Text,
            }),
          }),
        ],
        ['query'],
      ),
    'getCampaigns' : IDL.Func(
        [],
        [
          IDL.Variant({
            'Ok' : IDL.Vec(
              IDL.Record({
                'id' : IDL.Text,
                'title' : IDL.Text,
                'goalAmount' : IDL.Nat,
                'endDate' : IDL.Nat64,
                'owner' : IDL.Principal,
                'description' : IDL.Text,
                'currentAmount' : IDL.Nat,
                'withdrawn' : IDL.Bool,
                'startDate' : IDL.Nat64,
              })
            ),
            'Err' : IDL.Variant({
              'AuthorizationError' : IDL.Text,
              'ContributionError' : IDL.Text,
              'CampaignNotFound' : IDL.Text,
              'ValidationError' : IDL.Text,
              'LedgerError' : IDL.Text,
            }),
          }),
        ],
        ['query'],
      ),
    'getLedger' : IDL.Func([], [IDL.Principal], ['query']),
    'listContributions' : IDL.Func(
        [IDL.Text],
        [
          IDL.Variant({
            'Ok' : IDL.Vec(
              IDL.Record({
                'refunded' : IDL.Bool,
                'timestamp' : IDL.Nat64,
                'amount' : IDL.Nat,
                'contributor' : IDL.Principal,
              })
            ),
            'Err' : IDL.Variant({
              'AuthorizationError' : IDL.Text,
              'ContributionError' : IDL.Text,
              'CampaignNotFound' : IDL.Text,
              'ValidationError' : IDL.Text,
              'LedgerError' : IDL.Text,
            }),
          }),
        ],
        ['query'],
      ),
    'refund' : IDL.Func(
        [IDL.Text],
        [
          IDL.Variant({
            'Ok' : IDL.Text,
            'Err' : IDL.Variant({
              'AuthorizationError' : IDL.Text,
              'ContributionError' : IDL.Text,
              'CampaignNotFound' : IDL.Text,
              'ValidationError' : IDL.Text,
              'LedgerError' : IDL.Text,
            }),
          }),
        ],
        [],
      ),
    'withdrawFunds' : IDL.Func(
        [IDL.Text],
        [
          IDL.Variant({
            'Ok' : IDL.Text,
            'Err' : IDL.Variant({
              'AuthorizationError' : IDL.Text,
              'ContributionError' : IDL.Text,
              'CampaignNotFound' : IDL.Text,
              'ValidationError' : IDL.Text,
              'LedgerError' : IDL.Text,
            }),
          }),
        ],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return [IDL.Principal]; };
