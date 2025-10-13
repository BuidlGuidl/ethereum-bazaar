//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { IListingType } from "./IListingType.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SimpleListings is IListingType {
    // Custom errors
    error PriceZero();
    error IpfsHashEmpty();
    error NotActive();
    error IncorrectEth();
    error NoEthWithErc20();
    error Erc20TransferFailed();
    error NotCreator();
    error AlreadyClosed();
    error NotMarketplace();
    error MarketplaceZeroAddress();
    error EthSendFailed();
    error BeforeCloseFailed();
    error OnCloseFailed();
    error AfterCloseFailed();
    struct SimpleListing {
        address creator;
        address paymentToken; // address(0) for ETH, ERC20 otherwise
        uint256 price;
        string ipfsHash;
        bool active;
    }

    address public immutable marketplace;
    uint256 public simpleListingCount;
    mapping(uint256 => SimpleListing) public listings;

    event SimpleListingCreated(
        uint256 indexed listingId,
        address indexed creator,
        address paymentToken,
        uint256 price,
        string ipfsHash
    );
    event SimpleListingSold(uint256 indexed listingId, address indexed buyer, uint256 price, address paymentToken);
    event SimpleListingClosed(uint256 indexed listingId, address indexed caller);

    constructor(address _marketplace) {
        if (_marketplace == address(0)) revert MarketplaceZeroAddress();
        marketplace = _marketplace;
    }

    modifier onlyMarketplace() {
        if (msg.sender != marketplace) revert NotMarketplace();
        _;
    }

    // View helpers
    function getListing(uint256 listingId) external view returns (bytes memory data) {
        SimpleListing memory l = listings[listingId];
        return abi.encode(l.creator, l.paymentToken, l.price, l.ipfsHash, l.active);
    }

    // Creation lifecycle
    function beforeCreate(bytes calldata data) external view onlyMarketplace returns (bool) {
        // data encoding: abi.encode(address paymentToken, uint256 price, string ipfsHash)
        (, uint256 price, string memory ipfsHash) = abi.decode(data, (address, uint256, string));
        if (price == 0) revert PriceZero();
        if (bytes(ipfsHash).length == 0) revert IpfsHashEmpty();
        // paymentToken can be zero for ETH or any ERC20 address
        return true;
    }

    function onCreate(address creator, bytes calldata data) external onlyMarketplace returns (uint256 listingId) {
        (address paymentToken, uint256 price, string memory ipfsHash) = abi.decode(data, (address, uint256, string));
        listingId = ++simpleListingCount;
        listings[listingId] = SimpleListing({
            creator: creator,
            paymentToken: paymentToken,
            price: price,
            ipfsHash: ipfsHash,
            active: true
        });
        emit SimpleListingCreated(listingId, creator, paymentToken, price, ipfsHash);
    }

    function afterCreate(uint256 /*listingId*/, bytes calldata /*data*/) external view onlyMarketplace returns (bool) {
        return true;
    }

    // Sale lifecycle
    function beforeSale(
        uint256 listingId,
        address /*buyer*/,
        bytes calldata /*data*/
    ) external view onlyMarketplace returns (bool) {
        SimpleListing memory l = listings[listingId];
        if (!l.active) revert NotActive();
        return true;
    }

    function onSale(
        uint256 listingId,
        address buyer,
        bytes calldata /*data*/
    ) external payable onlyMarketplace returns (bool) {
        SimpleListing storage l = listings[listingId];
        if (!l.active) revert NotActive();

        if (l.paymentToken == address(0)) {
            if (msg.value != l.price) revert IncorrectEth();
            // forward ETH directly to creator
            (bool sent, ) = l.creator.call{ value: msg.value }("");
            if (!sent) revert EthSendFailed();
        } else {
            if (msg.value != 0) revert NoEthWithErc20();
            // buyer must approve this contract to spend price amount
            bool ok = IERC20(l.paymentToken).transferFrom(buyer, l.creator, l.price);
            if (!ok) revert Erc20TransferFailed();
        }

        emit SimpleListingSold(listingId, buyer, l.price, l.paymentToken);
        return true;
    }

    function afterSale(
        uint256 listingId,
        address /*buyer*/,
        bytes calldata /*data*/
    ) external onlyMarketplace returns (bool) {
        SimpleListing storage l = listings[listingId];
        if (!l.active) revert NotActive();
        l.active = false;
        return true;
    }

    // Pre-buy lifecycle (no-op for simple listings)
    function beforePreBuy(
        uint256 /*listingId*/,
        address /*buyer*/,
        bytes calldata /*data*/
    ) external view onlyMarketplace returns (bool) {
        return true;
    }

    function onPreBuy(
        uint256 /*listingId*/,
        address /*buyer*/,
        bytes calldata /*data*/
    ) external payable onlyMarketplace returns (bool) {
        return true;
    }

    function afterPreBuy(
        uint256 /*listingId*/,
        address /*buyer*/,
        bytes calldata /*data*/
    ) external view onlyMarketplace returns (bool) {
        return true;
    }

    // Admin lifecycle
    function beforeClose(
        uint256 listingId,
        address caller,
        bytes calldata /*data*/
    ) external view onlyMarketplace returns (bool) {
        SimpleListing memory l = listings[listingId];
        if (l.creator != caller) revert NotCreator();
        if (!l.active) revert AlreadyClosed();
        return true;
    }

    function onClose(
        uint256 listingId,
        address caller,
        bytes calldata /*data*/
    ) external onlyMarketplace returns (bool) {
        SimpleListing storage l = listings[listingId];
        if (l.creator != caller) revert NotCreator();
        if (!l.active) revert AlreadyClosed();
        l.active = false;
        return true;
    }

    function afterClose(
        uint256 listingId,
        address caller,
        bytes calldata /*data*/
    ) external onlyMarketplace returns (bool) {
        emit SimpleListingClosed(listingId, caller);
        return true;
    }
}
