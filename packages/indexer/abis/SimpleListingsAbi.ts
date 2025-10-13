export const SimpleListingsAbi = [
  {
    "inputs": [
      { "internalType": "address", "name": "_marketplace", "type": "address" }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  { "inputs": [], "name": "AlreadyClosed", "type": "error" },
  { "inputs": [], "name": "BeforeCloseFailed", "type": "error" },
  { "inputs": [], "name": "Erc20TransferFailed", "type": "error" },
  { "inputs": [], "name": "EthSendFailed", "type": "error" },
  { "inputs": [], "name": "IncorrectEth", "type": "error" },
  { "inputs": [], "name": "IpfsHashEmpty", "type": "error" },
  { "inputs": [], "name": "MarketplaceZeroAddress", "type": "error" },
  { "inputs": [], "name": "NoEthWithErc20", "type": "error" },
  { "inputs": [], "name": "NotCreator", "type": "error" },
  { "inputs": [], "name": "NotMarketplace", "type": "error" },
  { "inputs": [], "name": "OnCloseFailed", "type": "error" },
  { "inputs": [], "name": "PriceZero", "type": "error" },
  { "anonymous": false, "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "listingId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "creator", "type": "address" },
      { "indexed": false, "internalType": "address", "name": "paymentToken", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "price", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "ipfsHash", "type": "string" }
    ], "name": "SimpleListingCreated", "type": "event" },
  { "anonymous": false, "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "listingId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "buyer", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "price", "type": "uint256" },
      { "indexed": false, "internalType": "address", "name": "paymentToken", "type": "address" }
    ], "name": "SimpleListingSold", "type": "event" },
  { "anonymous": false, "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "listingId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "caller", "type": "address" }
    ], "name": "SimpleListingClosed", "type": "event" },
  { "inputs": [], "name": "marketplace", "outputs": [ { "internalType": "address", "name": "", "type": "address" } ], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "simpleListingCount", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" },
  { "inputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "name": "listings", "outputs": [
      { "internalType": "address", "name": "creator", "type": "address" },
      { "internalType": "address", "name": "paymentToken", "type": "address" },
      { "internalType": "uint256", "name": "price", "type": "uint256" },
      { "internalType": "string", "name": "ipfsHash", "type": "string" },
      { "internalType": "bool", "name": "active", "type": "bool" }
    ], "stateMutability": "view", "type": "function" },
] as const;

