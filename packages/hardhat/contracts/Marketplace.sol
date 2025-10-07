//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { IListingType } from "./IListingType.sol";

contract Marketplace {
    // Custom errors
    error ListingTypeZeroAddress();
    error ListingNotFound();
    error NotCreator();
    error BeforeCreateFailed();
    error InnerIdZero();
    error AfterCreateFailed();
    error BeforePreBuyFailed();
    error OnPreBuyFailed();
    error AfterPreBuyFailed();
    error BeforeSaleFailed();
    error OnSaleFailed();
    error AfterSaleFailed();
    error BeforeCloseFailed();
    error OnCloseFailed();
    error AfterCloseFailed();
    struct ListingPointer {
        address creator;
        address listingType; // contract implementing IListingType
        uint256 listingId; // ID inside the listing type contract
    }

    uint256 public listingCount;
    mapping(uint256 => ListingPointer) public listings;

    event ListingCreated(uint256 indexed id, address indexed creator, address indexed listingType, uint256 listingId);
    event ListingSold(uint256 indexed id, address indexed buyer);
    event ListingClosed(uint256 indexed id, address indexed caller);
    event ListingPreBuy(uint256 indexed id, address indexed buyer);

    modifier onlyListing(uint256 id) {
        if (listings[id].listingType == address(0)) revert ListingNotFound();
        _;
    }

    function createListing(address listingType, bytes calldata data) external returns (uint256 id) {
        if (listingType == address(0)) revert ListingTypeZeroAddress();

        // lifecycle: beforeCreate -> onCreate -> afterCreate
        if (!IListingType(listingType).beforeCreate(data)) revert BeforeCreateFailed();
        uint256 innerId = IListingType(listingType).onCreate(msg.sender, data);
        if (innerId == 0) revert InnerIdZero();

        id = ++listingCount;
        listings[id] = ListingPointer({ creator: msg.sender, listingType: listingType, listingId: innerId });

        if (!IListingType(listingType).afterCreate(innerId, data)) revert AfterCreateFailed();
        emit ListingCreated(id, msg.sender, listingType, innerId);
    }

    function preBuyAction(uint256 id, bytes calldata data) external payable onlyListing(id) {
        ListingPointer memory ptr = listings[id];

        if (!IListingType(ptr.listingType).beforePreBuy(ptr.listingId, msg.sender, data)) revert BeforePreBuyFailed();
        if (!IListingType(ptr.listingType).onPreBuy{ value: msg.value }(ptr.listingId, msg.sender, data))
            revert OnPreBuyFailed();
        if (!IListingType(ptr.listingType).afterPreBuy(ptr.listingId, msg.sender, data)) revert AfterPreBuyFailed();

        emit ListingPreBuy(id, msg.sender);
    }

    function buyListing(uint256 id, bytes calldata data) external payable onlyListing(id) {
        ListingPointer memory ptr = listings[id];

        // lifecycle: beforeSale -> onSale -> afterSale
        if (!IListingType(ptr.listingType).beforeSale(ptr.listingId, msg.sender, data)) revert BeforeSaleFailed();
        if (!IListingType(ptr.listingType).onSale{ value: msg.value }(ptr.listingId, msg.sender, data))
            revert OnSaleFailed();
        if (!IListingType(ptr.listingType).afterSale(ptr.listingId, msg.sender, data)) revert AfterSaleFailed();

        emit ListingSold(id, msg.sender);
    }

    function closeListing(uint256 id, bytes calldata data) external onlyListing(id) {
        ListingPointer memory ptr = listings[id];
        if (ptr.creator != msg.sender) revert NotCreator();

        if (!IListingType(ptr.listingType).beforeClose(ptr.listingId, msg.sender, data)) revert BeforeCloseFailed();
        if (!IListingType(ptr.listingType).onClose(ptr.listingId, msg.sender, data)) revert OnCloseFailed();
        if (!IListingType(ptr.listingType).afterClose(ptr.listingId, msg.sender, data)) revert AfterCloseFailed();
        emit ListingClosed(id, msg.sender);
    }

    function getListing(
        uint256 id
    ) external view onlyListing(id) returns (ListingPointer memory pointer, bytes memory data) {
        pointer = listings[id];
        data = IListingType(pointer.listingType).getListing(pointer.listingId);
    }
}
