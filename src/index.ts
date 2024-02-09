// Importing necessary modules from the 'azle' library and 'uuid' library
import {
  query,
  update,
  Canister,
  text,
  Record,
  StableBTreeMap,
  Ok,
  Err,
  Vec,
  Result,
  nat64,
  ic,
  Variant,
  Principal,
} from "azle";
import { v4 as uuidv4 } from "uuid";

// Defining record types for different entities
const CampaignPayload = Record({
  title: text,
  description: text,
  goalAmount: nat64,
});

const Campaign = Record({
  id: text,
  title: text,
  description: text,
  goalAmount: nat64,
  currentAmount: nat64,
  startDate: nat64,
  endDate: nat64,
  owner: Principal,
});

type Campaign = typeof Campaign.tsType;

const Contribution = Record({
  contributor: Principal,
  amount: nat64,
  timestamp: nat64,
});

type Contribution = typeof Contribution.tsType;

const Error = Variant({
  CampaignNotFound: text,
  ContributionError: text,
  AuthorizationError: text,
  ValidationError: text,
  StorageError: text,
});

// Creating instances of StableBTreeMap for each entity type
const campaignsStorage = StableBTreeMap<text, Campaign>(0);
const contributionsStorage = StableBTreeMap<text, Vec<Contribution>>(1);

function checkCampaignExistsAndActive(campaignId: text): Result<Campaign, Error> {
  const campaignOpt = campaignsStorage.get(campaignId);
  if ("None" in campaignOpt) {
    return Err({
      CampaignNotFound: `Campaign with id=${campaignId} not found`,
    });
  }

  const campaign = campaignOpt.Some;
  return Ok(campaign);
}

export default Canister({
  // Update methods

  // Create campaign
  createCampaign: update(
    [CampaignPayload],
    Result(text, Error),
    (campaignPayload) => {
      if (
        !campaignPayload.title ||
        !campaignPayload.description ||
        campaignPayload.goalAmount <= 0n
      ) {
        return Err({
          ValidationError:
            "Invalid input data: Ensure title, description are present and goal amount is positive.",
        });
      }
      const campaignId = uuidv4();
      const twentyFourHoursInNanoseconds = 24n * 60n * 60n * 1_000_000_000n;
      const endDate = ic.time() + twentyFourHoursInNanoseconds;
      const newCampaign = {
        id: campaignId,
        title: campaignPayload.title,
        description: campaignPayload.description,
        goalAmount: campaignPayload.goalAmount,
        currentAmount: 0n,
        owner: ic.caller(),
        startDate: ic.time(),
        endDate: endDate,
      };
      campaignsStorage.insert(campaignId, newCampaign);
      return Ok(campaignId);
    }
  ),

  // Contribute to campaign
  contribute: update(
    [text, nat64],
    Result(text, Error),
    (campaignId, amount) => {
      let campaign = checkCampaignExistsAndActive(campaignId);
      if(Err.is(campaign)){
        return campaign;
      }

      if (ic.time() > campaign.endDate) {
        return Err({ValidationError: "This campaign has already ended."});
      }

      if (campaign.currentAmount >= campaign.goalAmount) {
        return Err({
          ContributionError: `Campaign with id=${campaignId} has successfully reached its funding goal. No further contributions are needed.`,
        });
      }

      const newAmount = campaign.currentAmount + amount;
      if (newAmount > campaign.goalAmount) {
        return Err({
          ContributionError: `This contribution would exceed the campaign's funding goal. Please adjust the contribution amount.`,
        });
      }
      campaign.currentAmount = newAmount;
      campaignsStorage.insert(campaignId, campaign);
      const contribution = {
        contributor: ic.caller(),
        amount,
        timestamp: ic.time(),
      };
      let contributions = contributionsStorage.get(campaignId).Some || [];
      contributions.push(contribution);
      contributionsStorage.insert(campaignId, contributions);
      return Ok(
        `Contributed ${amount} for the campaign with id: ${campaignId}`
      );
    }
  ),

  // Withdraw funds
  withdrawFunds: update([text], Result(text, Error), (campaignId) => {
    const campaignOpt = campaignsStorage.get(campaignId);
    let campaign = checkCampaignExistsAndActive(campaignId);
    if(Err.is(campaign)){
      return campaign;
    }

    if (ic.caller().toString() !== campaign.owner.toString()) {
      return Err({
        AuthorizationError: `Only the campaign owner can withdraw funds. Caller: ${ic
          .caller()
          .toString()}, Owner: ${campaign.owner.toString()}`,
      });
    }

    if (campaign.currentAmount < campaign.goalAmount) {
      return Err({
        ValidationError:
          "Cannot withdraw funds as the campaign has not reached its funding goal.",
      });
    }

    if (campaign.currentAmount === 0n) {
      return Err({
        ValidationError: "Funds have already been withdrawn for this campaign.",
      });
    }

    campaign.currentAmount = 0n;
    campaignsStorage.insert(campaignId, campaign);

    return Ok(`Funds successfully withdrawn for campaign ${campaignId}`);
  }),

  // Delete campaign
  deleteCampaign: update([text], Result(text, Error), (campaignId) => {
    let campaign = checkCampaignExistsAndActive(campaignId);
    if(Err.is(campaign)){
      return campaign;
    }

    if (ic.caller().toString() !== campaign.owner.toString()) {
      return Err({
        AuthorizationError: `Only the campaign owner can delete this campaign. Caller: ${ic
          .caller()
          .toString()}, Owner: ${campaign.owner.toString()}`,
      });
    }

    campaignsStorage.remove(campaignId);
    return Ok(`Campaign ${campaignId} deleted successfully`);
  }),

  //   //Query methods

  // Get one campaign by id
  getCampaign: query([text], Result(Campaign, Error), (id) => {
    let campaign = checkCampaignExistsAndActive(id);
    if(Err.is(campaign)){
      return campaign;
    }
  }),

  // Get campaigns
  getCampaigns: query([], Result(Vec(Campaign), Error), () => {
    const campaigns: Campaign[] = [];
    for (const campaign of campaignsStorage.values()) {
      campaigns.push(campaign);
    }
    return Ok(campaigns);
  }),

  // List contributions
  listContributions: query(
    [text],
    Result(Vec(Contribution), Error),
    (campaignId) => {
      const contributionsOpt = contributionsStorage.get(campaignId);
      if ("None" in contributionsOpt) {
        return Err({
          CampaignNotFound: `No contributions found for campaign with id=${campaignId}`,
        });
      }
      return Ok(contributionsOpt.Some);
    }
  ),
});
