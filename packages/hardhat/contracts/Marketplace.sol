// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { IListingType } from "./IListingType.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Marketplace is ReentrancyGuard {
    error ListingCreationFailed();
    error OnlyListingTypeCanModify();
    error ListingNotFound();
    error NotListingCreator();

    struct ListingPointer {
        address creator;
        address listingType;
        string contenthash;
        bool active;
    }

    uint256 public listingCount;
    mapping(uint256 => ListingPointer) public listings;

    event ListingCreated(uint256 indexed id, address indexed creator, address indexed listingType, uint256 listingId, string contenthash);
    event ListingAction(uint256 indexed id, address indexed caller, bytes32 action);
    event ListingActivationChanged(uint256 indexed listingId, bool active);
    event ListingDeleted(uint256 indexed id);

    function createListing(
        address listingType,
        string calldata contenthash,
        bytes calldata data
    ) external nonReentrant returns (uint256 id) {
        id = listingCount++;
        bool success = IListingType(listingType).create(msg.sender, id, data);
        if (!success) revert ListingCreationFailed();
        listings[id] = ListingPointer(msg.sender, listingType, contenthash, true);
        emit ListingCreated(id, msg.sender, listingType, id, contenthash);
    }

    function callAction(
        uint256 id,
        bytes32 action,
        bytes calldata data
    ) external payable nonReentrant {
        if (id >= listingCount) revert ListingNotFound();
        ListingPointer memory ptr = listings[id];
        IListingType(ptr.listingType).handleAction{value: msg.value}(id, ptr.creator, ptr.active, msg.sender, action, data);
        emit ListingAction(id, msg.sender, action);
    }

    function setActive(uint256 listingId, bool active) external {
        ListingPointer storage record = listings[listingId];
        if (msg.sender != record.listingType) revert OnlyListingTypeCanModify();
        record.active = active;
        emit ListingActivationChanged(listingId, active);
    }

    function deleteListing(uint256 listingId) external {
        ListingPointer storage record = listings[listingId];
        if (record.creator == address(0)) revert ListingNotFound();
        if (msg.sender != record.creator) revert NotListingCreator();
        
        delete listings[listingId];
        emit ListingDeleted(listingId);
    }

    function getListing(uint256 id) external view returns (
        address creator,
        address listingType,
        string memory contenthash,
        bool active,
        bytes memory listingData
    ) {
        ListingPointer memory ptr = listings[id];
        creator = ptr.creator;
        listingType = ptr.listingType;
        contenthash = ptr.contenthash;
        active = ptr.active;
        listingData = IListingType(ptr.listingType).getListing(id);
    }
}
