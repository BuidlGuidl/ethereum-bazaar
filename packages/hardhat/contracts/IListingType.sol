//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

interface IListingType {
    // Creation lifecycle
    function beforeCreate(bytes calldata data) external returns (bool);
    function onCreate(address creator, bytes calldata data) external returns (uint256 listingId);
    function afterCreate(uint256 listingId, bytes calldata data) external returns (bool);

    // Sale lifecycle
    function beforeSale(uint256 listingId, address buyer, bytes calldata data) external returns (bool);
    function onSale(uint256 listingId, address buyer, bytes calldata data) external payable returns (bool);
    function afterSale(uint256 listingId, address buyer, bytes calldata data) external returns (bool);

    // Pre-buy lifecycle (e.g., escrow setup)
    function beforePreBuy(uint256 listingId, address buyer, bytes calldata data) external returns (bool);
    function onPreBuy(uint256 listingId, address buyer, bytes calldata data) external payable returns (bool);
    function afterPreBuy(uint256 listingId, address buyer, bytes calldata data) external returns (bool);

    // Admin lifecycle
    function beforeClose(uint256 listingId, address caller, bytes calldata data) external returns (bool);
    function onClose(uint256 listingId, address caller, bytes calldata data) external returns (bool);
    function afterClose(uint256 listingId, address caller, bytes calldata data) external returns (bool);

    // View helpers
    function getListing(uint256 listingId) external view returns (bytes memory data);
}
