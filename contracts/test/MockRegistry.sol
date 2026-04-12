// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockRegistry {
    mapping(address => bool) private registered;

    function setRegistered(address agent, bool status) external {
        registered[agent] = status;
    }

    function isRegisteredAgent(address agent) external view returns (bool) {
        return registered[agent];
    }
}
