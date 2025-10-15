//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

interface IListingType {
    struct ListingTypeMetadata {
        string name;          // e.g. "SimpleListing"
        string version;       // e.g. "1.0.0"
        string description;   // optional
        string abi;           // JSON ABI encoded as a string
    }

    /// @notice Creates a new listing
    /// @param creator The creator of the listing
    /// @param listingId The ID of the listing
    /// @param data The data for the listing
    /// @dev All listings start at this step
    function create(address creator, uint256 listingId, bytes calldata data)
        external
        returns (bool success);

    /// @notice Handles an action for a listing
    /// @param listingId The ID of the listing
    /// @param creator The creator of the listing
    /// @param active Whether the listing is active
    /// @param caller The caller of the action
    /// @param action The action to handle
    /// @param data The data for the action
    /// @dev The caller must be the marketplace contract
    function handleAction(
        uint256 listingId,
        address creator,
        bool active,
        address caller,
        bytes32 action,
        bytes calldata data
    ) external payable;

    /// @notice Returns the data for a listing
    /// @dev The data is the encoded data for the listing
    function getListing(uint256 listingId)
        external
        view
        returns (bytes memory data);
}
