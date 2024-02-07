# Crowdfunding-ICP

This is ICP smart ontract that manages: creating campaigns, contributing to campaigns, tracking campaign progress, and distributing funds upon campaign completion.

## Overview

This is a Kickstarter like decentralized crowdfunding platform, where you can create and run campaigns or simply participate in the existing ones by providing contributions.
Campaigns have their owner, goal amount and end date. Only Campaign creator can manage his campaign, and other actors can contribute to the campaign they wish. Clients can list
all campaigns and choose the one they like. Campaign owner can withdraw collected contributions when the goal is reached.

## Geting started

### Prerequisites

- Node.js
- Typescript
- DFX
- Azle

### Instalation

- git clone https://github.com/emboth/Crowdfunding-ICP.git
- cd crowdfunding-icp
- dfx install
- npm install

### Project structure

- src/: Contains the source code.
  - index.ts: App entry point.
- node modules/: Contains project dependencies.
- package.json: Configuration file for npm, including project dependencies and scripts.
- tsconfig.json: TypeScript configuration file, specifying compiler options.
- LICENSE: MIT License file, detailing the terms under which the project is licensed.
- README.md: Project documentation providing an overview, installation instructions, usage details, and license information.

### Functions

- createCampaign

  - Purpose: Initiates a new crowdfunding campaign with the provided details, ensuring the campaign is correctly set up for contributions.
  - Parameters: campaignPayload (CampaignPayload): Object containing the necessary details for creating a campaign. It includes:
    - title (text): The campaign's title.
    - description (text): Detailed description of the campaign.
    - goalAmount (nat): The financial goal to be achieved.
  - Returns: Result(text, Error): On success, returns the unique ID of the created campaign. On failure, returns an error detailing the issue.

- contribute

  - Purpose: Enables users to contribute to an existing campaign by specifying its ID and the contribution amount.
  - Parameters: campaignId (text): Unique identifier of the campaign to contribute to.
    - amount (nat64): Amount to contribute to the campaign.
  - Returns: Result(text, Error): Confirmation of contribution on success, or an error message on failure.

- withdrawFunds

  - Purpose: Allows the campaign owner to withdraw the collected funds once the campaign has reached its funding goal.
  - Parameters: campaignId (text): The unique identifier of the campaign from which funds will be withdrawn.
  - Returns: Result(text, Error): A success message if the withdrawal was successful, or an error message detailing why the withdrawal failed.

- deleteCampaign

  - Purpose: Permits the campaign owner to delete their campaign, removing it from the system.
  - Parameters: campaignId (text): The unique identifier of the campaign to be deleted.
  - Returns: Result(text, Error): A success message if the campaign was successfully deleted, or an error message if the deletion failed.

- getCampaign

  - Purpose: Retrieves detailed information about a specific campaign, identified by its ID.
  - Parameters: id (text): The unique identifier of the campaign to retrieve.
  - Returns: Result(Campaign, Error): Detailed information about the campaign if found, or an error message if the campaign does not exist.

- getCampaigns

  - Purpose: Fetches a list of all campaigns currently available in the system.
  - Parameters: None
  - Returns: Result(Vec(Campaign), Error): A list of all campaigns if successful, or an error message if the operation fails.

- listContributions

  - Purpose: Lists all contributions made to a specific campaign, providing insight into the campaign's support.
  - Parameters: campaignId (text): The unique identifier of the campaign whose contributions are to be listed.
  - Returns: Result(Vec(Contribution), Error): A list of contributions to the specified campaign if successful, or an error message detailing why the operation failed.

  ### Try it out

  Now that we have our canister code, let us build and deploy our canister.

  - First, let us start our local Azle replica in the background . Run the following command in your terminal:
    `dfx start --background

  ### IMPORTANT NOTE

  If you make any changes to the StableBTreeMap structure like change datatypes for keys or values, changing size of the key or value, you need to restart dfx with the –clean flag. StableBTreeMap is immutable and any changes to it's configuration after it's been initialized are not supported.

  `dfx start --background --clean

  - Next, let us build and deploy our canister. Run the following command in your terminal:
    `dfx deploy

  If this is your first time running the command, which most likely it is, this may take a bit of time to boot up, so sit back and relax.
  Once its done, you should see a similar output:

- Deployed canisters.
  URLs:
  Backend canister via Candid interface:
  message_board: http://127.0.0.1:4943/?canisterId=bd3sg-teaaa-aaaaa-qaaba-cai&id=bkyz2-fmaaa-aaaaa-qaaaq-cai

### Interacting with our canister

We have two ways of interacting with our canister. We can either use the command line interface or the web interface. Let us start with the command line interface.

- Command line interface

`dfx canister call <canister_name> createCampaign '(record {title = "Campaign Title"; description = "Campaign Description"; goalAmount = <goal_amount>})'

`dfx canister call <canister_name> contribute '(record {campaignId = "<campaign_id>"; amount = <contribution_amount>})'

`dfx canister call <canister_name> withdrawFunds '(record {campaignId = "<campaign_id>"})'

`dfx canister call <canister_name> deleteCampaign '(record {campaignId = "<campaign_id>"})'

`dfx canister call <canister_name> getCampaign '(record {id = "<campaign_id>"})'

`dfx canister call <canister_name> getCampaigns '()'

`dfx canister call <canister_name> listContributions '(record {campaignId = "<campaign_id>"})'

- Web interface
  Just as we used the interface to get the message we just created in the previous section, you can use it add, update, delete, and get messages from your canister as well as call other functions you may add in your cannister.

Finally, you can shut down your local Azle replica by running the following command in your terminal:

`dfx stop

### Contributing

Contributions are welcome! If you'd like to contribute, feel free to submit a pull request or create an issue on the repository.

### License

This project is licensed under the MIT License.
