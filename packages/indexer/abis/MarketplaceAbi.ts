export const MarketplaceAbi = [
  {
    "inputs": [],
    "name": "AfterCloseFailed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "AfterCreateFailed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "AfterPreBuyFailed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "AfterSaleFailed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "BeforeCloseFailed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "BeforeCreateFailed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "BeforePreBuyFailed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "BeforeSaleFailed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InnerIdZero",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ListingNotFound",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ListingTypeZeroAddress",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotCreator",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "OnCloseFailed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "OnPreBuyFailed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "OnSaleFailed",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "caller",
        "type": "address"
      }
    ],
    "name": "ListingClosed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "creator",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "listingType",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "listingId",
        "type": "uint256"
      }
    ],
    "name": "ListingCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "buyer",
        "type": "address"
      }
    ],
    "name": "ListingPreBuy",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "buyer",
        "type": "address"
      }
    ],
    "name": "ListingSold",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "data",
        "type": "bytes"
      }
    ],
    "name": "buyListing",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "data",
        "type": "bytes"
      }
    ],
    "name": "closeListing",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "listingType",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "data",
        "type": "bytes"
      }
    ],
    "name": "createListing",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "getListing",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "creator",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "listingType",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "listingId",
            "type": "uint256"
          }
        ],
        "internalType": "struct Marketplace.ListingPointer",
        "name": "pointer",
        "type": "tuple"
      },
      {
        "internalType": "bytes",
        "name": "data",
        "type": "bytes"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "listingCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "listings",
    "outputs": [
      {
        "internalType": "address",
        "name": "creator",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "listingType",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "listingId",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "data",
        "type": "bytes"
      }
    ],
    "name": "preBuyAction",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
] as const;

