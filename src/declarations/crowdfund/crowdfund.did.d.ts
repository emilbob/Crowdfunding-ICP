import type { Principal } from '@icp-sdk/core/principal';
import type { ActorMethod } from '@icp-sdk/core/agent';
import type { IDL } from '@icp-sdk/core/candid';

export interface _SERVICE {
  'contribute' : ActorMethod<
    [string, bigint],
    { 'Ok' : string } |
      {
        'Err' : { 'AuthorizationError' : string } |
          { 'ContributionError' : string } |
          { 'CampaignNotFound' : string } |
          { 'ValidationError' : string } |
          { 'LedgerError' : string }
      }
  >,
  'createCampaign' : ActorMethod<
    [
      {
        'durationDays' : bigint,
        'title' : string,
        'goalAmount' : bigint,
        'description' : string,
      },
    ],
    { 'Ok' : string } |
      {
        'Err' : { 'AuthorizationError' : string } |
          { 'ContributionError' : string } |
          { 'CampaignNotFound' : string } |
          { 'ValidationError' : string } |
          { 'LedgerError' : string }
      }
  >,
  'deleteCampaign' : ActorMethod<
    [string],
    { 'Ok' : string } |
      {
        'Err' : { 'AuthorizationError' : string } |
          { 'ContributionError' : string } |
          { 'CampaignNotFound' : string } |
          { 'ValidationError' : string } |
          { 'LedgerError' : string }
      }
  >,
  'getCampaign' : ActorMethod<
    [string],
    {
        'Ok' : {
          'id' : string,
          'title' : string,
          'goalAmount' : bigint,
          'endDate' : bigint,
          'owner' : Principal,
          'description' : string,
          'currentAmount' : bigint,
          'withdrawn' : boolean,
          'startDate' : bigint,
        }
      } |
      {
        'Err' : { 'AuthorizationError' : string } |
          { 'ContributionError' : string } |
          { 'CampaignNotFound' : string } |
          { 'ValidationError' : string } |
          { 'LedgerError' : string }
      }
  >,
  'getCampaigns' : ActorMethod<
    [],
    {
        'Ok' : Array<
          {
            'id' : string,
            'title' : string,
            'goalAmount' : bigint,
            'endDate' : bigint,
            'owner' : Principal,
            'description' : string,
            'currentAmount' : bigint,
            'withdrawn' : boolean,
            'startDate' : bigint,
          }
        >
      } |
      {
        'Err' : { 'AuthorizationError' : string } |
          { 'ContributionError' : string } |
          { 'CampaignNotFound' : string } |
          { 'ValidationError' : string } |
          { 'LedgerError' : string }
      }
  >,
  'getLedger' : ActorMethod<[], Principal>,
  'listContributions' : ActorMethod<
    [string],
    {
        'Ok' : Array<
          {
            'refunded' : boolean,
            'timestamp' : bigint,
            'amount' : bigint,
            'contributor' : Principal,
          }
        >
      } |
      {
        'Err' : { 'AuthorizationError' : string } |
          { 'ContributionError' : string } |
          { 'CampaignNotFound' : string } |
          { 'ValidationError' : string } |
          { 'LedgerError' : string }
      }
  >,
  'refund' : ActorMethod<
    [string],
    { 'Ok' : string } |
      {
        'Err' : { 'AuthorizationError' : string } |
          { 'ContributionError' : string } |
          { 'CampaignNotFound' : string } |
          { 'ValidationError' : string } |
          { 'LedgerError' : string }
      }
  >,
  'withdrawFunds' : ActorMethod<
    [string],
    { 'Ok' : string } |
      {
        'Err' : { 'AuthorizationError' : string } |
          { 'ContributionError' : string } |
          { 'CampaignNotFound' : string } |
          { 'ValidationError' : string } |
          { 'LedgerError' : string }
      }
  >,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
