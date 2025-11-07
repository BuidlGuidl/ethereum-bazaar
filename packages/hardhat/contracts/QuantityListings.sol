//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { IListingType } from "./IListingType.sol";
import { Marketplace } from "./Marketplace.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title QuantityListings
 * @notice Listing type with per-unit pricing and optional quantity tracking.
 *         - pricePerUnit is paid per purchased unit
 *         - initialQuantity == 0 encodes "unlimited", remainingQuantity stays 0 and never decrements
 *         - For limited listings, remainingQuantity decreases on each purchase; when it hits 0, listing is deactivated
 *         - buy(...) accepts optional bytes data with abi.encode(uint256 quantity). If omitted or zero, defaults to 1
 */
contract QuantityListings is IListingType {
    error PriceZero();
    error NotActive();
    error IncorrectEth();
    error NoEthWithErc20();
    error Erc20TransferFailed();
    error NotCreator();
    error NotMarketplace();
    error MarketplaceZeroAddress();
    error EthSendFailed();
    error UnknownAction();
    error NotSelf();
    error QuantityZero();
    error InsufficientQuantity();

    struct QuantityListing {
        address paymentToken;       // address(0) for ETH, ERC20 otherwise
        uint256 pricePerUnit;       // price per unit
        uint256 initialQuantity;    // 0 => unlimited
        uint256 remainingQuantity;  // 0 => unlimited semantics, otherwise remaining count
    }

    address public immutable marketplace;
    mapping(uint256 => QuantityListing) public listings;

    event QuantityListingCreated(
        uint256 indexed listingId,
        address indexed creator,
        address paymentToken,
        uint256 pricePerUnit,
        uint256 initialQuantity
    );
    event QuantityListingSold(
        uint256 indexed listingId,
        address indexed buyer,
        uint256 unitPrice,
        uint256 quantity,
        uint256 totalPrice,
        address paymentToken,
        uint256 remainingQuantity
    );
    event QuantityListingClosed(uint256 indexed listingId, address indexed caller);

    constructor(address _marketplace) {
        if (_marketplace == address(0)) revert MarketplaceZeroAddress();
        marketplace = _marketplace;
    }

    modifier onlyMarketplace() {
        if (msg.sender != marketplace) revert NotMarketplace();
        _;
    }

    modifier onlySelf() {
        if (msg.sender != address(this)) revert NotSelf();
        _;
    }

    modifier isActive(bool active) {
        if (!active) revert NotActive();
        _;
    }

    // View helpers
    function getListing(uint256 listingId) external view returns (bytes memory data) {
        QuantityListing memory l = listings[listingId];
        return abi.encode(l.paymentToken, l.pricePerUnit, l.initialQuantity, l.remainingQuantity);
    }

    // IListingType: create a new listing bound to the marketplace-provided id
    // data = abi.encode(address paymentToken, uint256 pricePerUnit, uint256 initialQuantity)
    function create(address creator, uint256 listingId, bytes calldata data) external onlyMarketplace returns (bool success) {
        (address paymentToken, uint256 pricePerUnit, uint256 initialQuantity) =
            abi.decode(data, (address, uint256, uint256));
        if (pricePerUnit == 0) revert PriceZero();
        // remainingQuantity mirrors initialQuantity unless unlimited (0)
        listings[listingId] = QuantityListing({
            paymentToken: paymentToken,
            pricePerUnit: pricePerUnit,
            initialQuantity: initialQuantity,
            remainingQuantity: initialQuantity
        });
        emit QuantityListingCreated(listingId, creator, paymentToken, pricePerUnit, initialQuantity);
        return true;
    }

    // Exposed entrypoints for dynamic dispatch; guarded so they can only be invoked via handleAction
    // data for buy = abi.encode(uint256 quantity) (defaults to 1 if omitted or zero)
    function buy(
        uint256 listingId,
        address creator,
        bool active,
        address buyer,
        bytes calldata data
    ) external payable onlySelf isActive(active) {
        QuantityListing storage l = listings[listingId];

        uint256 quantity = 1;
        if (data.length > 0) {
            quantity = abi.decode(data, (uint256));
            if (quantity == 0) quantity = 1;
        }

        // limited if initialQuantity > 0
        bool limited = l.initialQuantity > 0;
        if (limited) {
            if (l.remainingQuantity < quantity) revert InsufficientQuantity();
        }

        uint256 totalPrice = l.pricePerUnit * quantity;

        if (l.paymentToken == address(0)) {
            if (msg.value != totalPrice) revert IncorrectEth();
            (bool sent, ) = creator.call{ value: msg.value }("");
            if (!sent) revert EthSendFailed();
        } else {
            if (msg.value != 0) revert NoEthWithErc20();
            bool ok = IERC20(l.paymentToken).transferFrom(buyer, creator, totalPrice);
            if (!ok) revert Erc20TransferFailed();
        }

        // Update remaining and close if we hit zero for limited listings
        if (limited) {
            unchecked {
                l.remainingQuantity = l.remainingQuantity - quantity;
            }
            if (l.remainingQuantity == 0) {
                Marketplace(marketplace).setActive(listingId, false);
            }
        }

        emit QuantityListingSold(listingId, buyer, l.pricePerUnit, quantity, totalPrice, l.paymentToken, l.remainingQuantity);
    }

    function close(
        uint256 listingId,
        address creator,
        bool active,
        address caller,
        bytes calldata /*data*/
    ) external onlySelf isActive(active) {
        if (creator != caller) revert NotCreator();
        Marketplace(marketplace).setActive(listingId, false);
        emit QuantityListingClosed(listingId, caller);
    }

    function handleAction(
        uint256 listingId,
        address creator,
        bool active,
        address caller,
        bytes32 action,
        bytes calldata data
    ) external payable onlyMarketplace {
        // dynamic dispatch to self with the provided selector; functions are protected by onlySelf
        bytes4 selector = bytes4(action);
        (bool ok, bytes memory reason) = address(this).call{ value: msg.value }(
            abi.encodeWithSelector(selector, listingId, creator, active, caller, data)
        );
        if (!ok) {
            if (reason.length > 0) {
                assembly {
                    revert(add(reason, 0x20), mload(reason))
                }
            }
            revert UnknownAction();
        }
    }
}


