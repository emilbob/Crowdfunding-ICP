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
} from "azle";
import { v4 as uuidv4 } from "uuid";

const Campaign = Record({
  title: text,
  description: text,
  goalAmount: nat64,
});

const Contribution = Record({
  contributor: text,
  amount: nat64,
  timestamp: nat64,
});

const Error = Variant({
  CampaignNotFound: text,
  ContributionError: text,
  AuthorizationError: text,
  ValidationError: text,
  StorageError: text,
});

const campaignsStorage = StableBTreeMap(text, Campaign, 0);
const contributionsStorage = StableBTreeMap(text, Vec(Contribution), 0);

export default Canister({
  //Update methods

  // Create campaign
  createCampaign: update([Campaign], Result(text, Error), (campaignPayload) => {
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
      ...campaignPayload,
      id: campaignId,
      currentAmount: 0n,
      owner: ic.caller(),
      startDate: ic.time(),
      endDate: endDate,
    };

    campaignsStorage.insert(campaignId, newCampaign);
    return Ok(campaignId);
  }),

  // Contribute to campaign
  contribute: update(
    [text, nat64],
    Result(text, Error),
    (campaignId, amount) => {
      const campaignOpt = campaignsStorage.get(campaignId);
      if ("None" in campaignOpt) {
        return Err({
          CampaignNotFound: `Campaign with id=${campaignId} not found`,
        });
      }

      let campaign = campaignOpt.Some;

      if (ic.time() > campaign.endDate) {
        return Err({ ValidationError: "This campaign has already ended." });
      }

      if (campaign.currentAmount >= campaign.goalAmount) {
        return Err({
          ContributionError: `Campaign with id=${campaignId} has successfully reached its funding goal. No further contributions are needed.`,
        });
      }

      // Prevent contribution from exceeding goal amount
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

  //Withdraw funds
  withdrawFunds: update([text], Result(text, Error), (campaignId) => {
    const campaignOpt = campaignsStorage.get(campaignId);
    if ("None" in campaignOpt) {
      return Err({
        CampaignNotFound: `Campaign with id=${campaignId} not found`,
      });
    }
    const campaign = campaignOpt.Some;
    if (ic.caller() !== campaign.owner) {
      return Err({
        AuthorizationError: "Only the campaign owner can withdraw funds",
      });
    }

    if (campaign.currentAmount < campaign.goalAmount) {
      return Err({
        AuthorizationError: "Campaign has not reached its funding goal",
      });
    }

    return Ok(
      `Successfully withdrawn goal amount from the ${campaignId} camapign`
    );
  }),

  //Delete campaign
  deleteCampaign: update([text], Result(text, Error), (campaignId) => {
    const campaignOpt = campaignsStorage.get(campaignId);
    if ("None" in campaignOpt) {
      return Err({
        CampaignNotFound: `Campaign with id=${campaignId} not found`,
      });
    }

    const campaign = campaignOpt.Some;

    // Check if caller is the owner and goal is reached
    if (ic.caller() !== campaign.owner) {
      return Err({
        AuthorizationError: "Only the campaign owner can delete this campaign",
      });
    }
    if (campaign.currentAmount < campaign.goalAmount) {
      return Err({ ValidationError: "Campaign goal has not been reached yet" });
    }

    campaignsStorage.delete(campaignId);

    return Ok(`Campaign ${campaignId} deleted successfully`);
  }),

  //   //Query methods

  //Get campaigns
  getCampaigns: query([], Result(Vec(Campaign), Error), () => {
    try {
      const campaigns = campaignsStorage.values();
      return Ok(campaigns);
    } catch (error) {
      // Handle any unexpected errors
      return Err({
        StorageError: "Failed to retrieve campaigns from storage.",
      });
    }
  }),

  //Get one campaign
  getCampaign: query([text], Result(Campaign, Error), (id) => {
    const campaignOpt = campaignsStorage.get(id);
    if ("None" in campaignOpt) {
      return Err({ CampaignNotFound: `Campaign with id=${id} not found` });
    }
    return Ok(campaignOpt.Some);
  }),

  //List contributors
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
