//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { IListingType } from "./IListingType.sol";
import { Marketplace } from "./Marketplace.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SimpleListings is IListingType {
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

    struct SimpleListing {
        address paymentToken; // address(0) for ETH, ERC20 otherwise
        uint256 price;
    }

    address public immutable marketplace;
    mapping(uint256 => SimpleListing) public listings;

    event SimpleListingCreated(
        uint256 indexed listingId,
        address indexed creator,
        address paymentToken,
        uint256 price
    );
    event SimpleListingSold(uint256 indexed listingId, address indexed buyer, uint256 price, address paymentToken);
    event SimpleListingClosed(uint256 indexed listingId, address indexed caller);
    event SimpleListingUpdated(uint256 indexed listingId, address indexed caller, address paymentToken, uint256 price);

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
        SimpleListing memory l = listings[listingId];
        return abi.encode(l.paymentToken, l.price);
    }

    // IListingType: create a new listing bound to the marketplace-provided id
    function create(address creator, uint256 listingId, bytes calldata data) external onlyMarketplace returns (bool success) {
        (address paymentToken, uint256 price) = abi.decode(data, (address, uint256));
        if (price == 0) revert PriceZero();
        listings[listingId] = SimpleListing({
            paymentToken: paymentToken,
            price: price
        });
        emit SimpleListingCreated(listingId, creator, paymentToken, price);
        return true;
    }

    // Exposed entrypoints for dynamic dispatch; guarded so they can only be invoked via handleAction
    function buy(
        uint256 listingId,
        address creator,
        bool active,
        address buyer,
        bytes calldata /*data*/
    ) external payable onlySelf isActive(active) {
        SimpleListing storage l = listings[listingId];
        Marketplace(marketplace).setActive(listingId, false);
        if (l.paymentToken == address(0)) {
            if (msg.value != l.price) revert IncorrectEth();
            (bool sent, ) = creator.call{ value: msg.value }("");
            if (!sent) revert EthSendFailed();
        } else {
            if (msg.value != 0) revert NoEthWithErc20();
            bool ok = IERC20(l.paymentToken).transferFrom(buyer, creator, l.price);
            if (!ok) revert Erc20TransferFailed();
        }
        emit SimpleListingSold(listingId, buyer, l.price, l.paymentToken);
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
        emit SimpleListingClosed(listingId, caller);
    }

    function update(
        uint256 listingId,
        address creator,
        bool,
        address caller,
        bytes calldata data
    ) external onlySelf {
        if (creator != caller) revert NotCreator();
        (address paymentToken, uint256 price) = abi.decode(data, (address, uint256));
        if (price == 0) revert PriceZero();
        listings[listingId] = SimpleListing({ paymentToken: paymentToken, price: price });
        emit SimpleListingUpdated(listingId, caller, paymentToken, price);
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
