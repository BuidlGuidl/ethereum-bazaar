# Marketplace Mini App

Farcaster-ready marketplace mini app built on Scaffold-ETH 2. It lets creators publish fixed-price listings payable in ETH or ERC-20, buyers purchase them trustlessly, and both parties leave on-chain EAS reviews. The app ships with a modular contract design, a Next.js frontend wired to SE-2 hooks, and optional indexing via Ponder.

## What’s inside
- **Frontend**: Next.js (App Router), Wagmi/Viem, RainbowKit, SE-2 components and hooks. Farcaster Mini App integration (Quick Auth, splash handling).
- **Contracts**: `Marketplace`, `IListingType`, `SimpleListings`, and local `TestERC20` tokens for dev.
- **Reviews**: EAS review schema registered automatically on local and known networks; config is emitted for frontend and indexer.
- **Indexer**: Ponder project to index marketplace and review activity.

## Farcaster Mini App integration
- The mini app calls `sdk.actions.ready()` after the app is mounted to dismiss the splash screen (see `packages/nextjs/components/MiniappProvider.tsx`).
- Authenticated requests can be made with `sdk.quickAuth.fetch` or by pulling a token via `sdk.quickAuth.getToken` on the client and sending it to your backend. See Farcaster Mini App docs for validation on the server using `@farcaster/quick-auth`.

## Contracts architecture

### Roles and components
- **Marketplace.sol**: Router/orchestrator that stores pointers to listings and delegates all lifecycle operations to a pluggable listing-type contract implementing `IListingType`.
- **IListingType.sol**: Lifecycle interface that any listing-type must implement. Phases: create, optional pre-buy, sale, and admin close; each has `before`, `on`, and `after` hooks.
- **SimpleListings.sol**: A concrete `IListingType` implementation for fixed-price listings payable in ETH or an ERC-20.
- **TestERC20.sol**: Simple mintable tokens for local development (2 and 6 decimals). Only deployed on `localhost`/`hardhat`.

### Marketplace data model
- `listingCount`: sequential marketplace-level IDs starting at 1.
- `listings[id]`: `ListingPointer { creator, listingType, listingId }` where:
  - `listingType` is the address of the listing-type contract (e.g., `SimpleListings`).
  - `listingId` is the inner ID returned by the listing-type on creation.

### Lifecycle and how contracts interact
1) **Create**: `Marketplace.createListing(listingType, data)`
   - Calls `beforeCreate(data)` on the `listingType`.
   - Calls `onCreate(msg.sender, data)` which returns `innerId` (must be non-zero).
   - Stores `ListingPointer` under new marketplace ID and calls `afterCreate`.
   - Emits `ListingCreated(id, creator, listingType, innerId)`.

2) **Optional pre-buy step**: `Marketplace.preBuyAction(id, data)`
   - Delegates to `beforePreBuy / onPreBuy / afterPreBuy` on the `listingType` and emits `ListingPreBuy`.
   - Useful for escrows, auctions, or reservations. `SimpleListings` treats this as a no-op.

3) **Sale**: `Marketplace.buyListing(id, data)`
   - Calls `beforeSale / onSale / afterSale` on the `listingType`, then emits `ListingSold(id, buyer)`.

4) **Close**: `Marketplace.closeListing(id, data)`
   - Only the marketplace-level `creator` can close. Delegates to `beforeClose / onClose / afterClose` and emits `ListingClosed`.

### SimpleListings data and behavior
- Stored as `SimpleListing { creator, paymentToken, price, ipfsHash, active }`.
- `paymentToken == address(0)`: buyer pays in ETH by sending exactly `price` wei. ETH is forwarded directly to the creator.
- `paymentToken != address(0)`: buyer pays in ERC-20; must approve `SimpleListings` for `price` before calling `buyListing`. No ETH is accepted in this path.
- On successful sale, an event `SimpleListingSold(listingId, buyer, price, paymentToken)` is emitted and the listing is set inactive.
- Only the listing `creator` can close an active listing via the marketplace; closing marks it inactive and emits `SimpleListingClosed`.

### Encoding and views
- `createListing(listingType, data)` forwards `data` to the listing-type. For `SimpleListings`, `data` must be `abi.encode(address paymentToken, uint256 price, string ipfsHash)`.
- `getListing(id)` returns `(ListingPointer pointer, bytes data)`, where `data` is `listingType.getListing(pointer.listingId)`.
- For `SimpleListings.getListing(listingId)`, `data` is `abi.encode(creator, paymentToken, price, ipfsHash, active)`.

### Events
- Marketplace: `ListingCreated`, `ListingPreBuy`, `ListingSold`, `ListingClosed`.
- SimpleListings: `SimpleListingCreated`, `SimpleListingSold`, `SimpleListingClosed`.

## EAS Reviews
- A review schema `uint256 listingId,uint8 rating,string commentIPFSHash` is registered by `packages/hardhat/deploy/05_register_review_schema.ts` on local and known networks.
- After deployment, config is written to:
  - Frontend: `packages/nextjs/contracts/easConfig.json`
  - Indexer: `packages/indexer/src/easConfig.json`
- Use these addresses/UIDs from your app or indexer to submit and query review attestations.

## Local development
1. Start a local chain:
   - `yarn chain`
2. Deploy contracts (Marketplace, SimpleListings):
   - `yarn deploy`
3. (Optional) Deploy local EAS core + register review schema:
   - `yarn deploy --tags EASLocal,ReviewSchema`
4. (Optional) Deploy local test tokens:
   - `yarn deploy --tags TestERC20`
5. Start the frontend:
   - `yarn start` → `http://localhost:3000`

Contract artifacts/addresses are available under `packages/hardhat/deployments/<network>/`. The frontend uses SE-2’s generated `deployedContracts.ts` wiring for reads/writes.

## Frontend contract interactions (SE-2 way)
- Reads: `useScaffoldReadContract({ contractName, functionName, args })`
- Writes: `useScaffoldWriteContract({ contractName })` → `writeContractAsync({ functionName, args, value? })`
- Events: `useScaffoldEventHistory({ contractName, eventName, watch? })`

---

# 🏗 Scaffold-ETH 2

<h4 align="center">
  <a href="https://docs.scaffoldeth.io">Documentation</a> |
  <a href="https://scaffoldeth.io">Website</a>
</h4>

🧪 An open-source, up-to-date toolkit for building decentralized applications (dapps) on the Ethereum blockchain. It's designed to make it easier for developers to create and deploy smart contracts and build user interfaces that interact with those contracts.

⚙️ Built using NextJS, RainbowKit, Hardhat, Wagmi, Viem, and Typescript.

- ✅ **Contract Hot Reload**: Your frontend auto-adapts to your smart contract as you edit it.
- 🪝 **[Custom hooks](https://docs.scaffoldeth.io/hooks/)**: Collection of React hooks wrapper around [wagmi](https://wagmi.sh/) to simplify interactions with smart contracts with typescript autocompletion.
- 🧱 [**Components**](https://docs.scaffoldeth.io/components/): Collection of common web3 components to quickly build your frontend.
- 🔥 **Burner Wallet & Local Faucet**: Quickly test your application with a burner wallet and local faucet.
- 🔐 **Integration with Wallet Providers**: Connect to different wallet providers and interact with the Ethereum network.

![Debug Contracts tab](https://github.com/scaffold-eth/scaffold-eth-2/assets/55535804/b237af0c-5027-4849-a5c1-2e31495cccb1)

## Requirements

Before you begin, you need to install the following tools:

- [Node (>= v20.18.3)](https://nodejs.org/en/download/)
- Yarn ([v1](https://classic.yarnpkg.com/en/docs/install/) or [v2+](https://yarnpkg.com/getting-started/install))
- [Git](https://git-scm.com/downloads)

## Quickstart

To get started with Scaffold-ETH 2, follow the steps below:

1. Install dependencies if it was skipped in CLI:

```
cd my-dapp-example
yarn install
```

2. Run a local network in the first terminal:

```
yarn chain
```

This command starts a local Ethereum network using Hardhat. The network runs on your local machine and can be used for testing and development. You can customize the network configuration in `packages/hardhat/hardhat.config.ts`.

3. On a second terminal, deploy the test contract:

```
yarn deploy
```

This command deploys a test smart contract to the local network. The contract is located in `packages/hardhat/contracts` and can be modified to suit your needs. The `yarn deploy` command uses the deploy script located in `packages/hardhat/deploy` to deploy the contract to the network. You can also customize the deploy script.

4. On a third terminal, start your NextJS app:

```
yarn start
```

Visit your app on: `http://localhost:3000`. You can interact with your smart contract using the `Debug Contracts` page. You can tweak the app config in `packages/nextjs/scaffold.config.ts`.

Run smart contract test with `yarn hardhat:test`

- Edit your smart contracts in `packages/hardhat/contracts`
- Edit your frontend homepage at `packages/nextjs/app/page.tsx`. For guidance on [routing](https://nextjs.org/docs/app/building-your-application/routing/defining-routes) and configuring [pages/layouts](https://nextjs.org/docs/app/building-your-application/routing/pages-and-layouts) checkout the Next.js documentation.
- Edit your deployment scripts in `packages/hardhat/deploy`


## Documentation

Visit our [docs](https://docs.scaffoldeth.io) to learn how to start building with Scaffold-ETH 2.

To know more about its features, check out our [website](https://scaffoldeth.io).

## Contributing to Scaffold-ETH 2

We welcome contributions to Scaffold-ETH 2!

Please see [CONTRIBUTING.MD](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/CONTRIBUTING.md) for more information and guidelines for contributing to Scaffold-ETH 2.
