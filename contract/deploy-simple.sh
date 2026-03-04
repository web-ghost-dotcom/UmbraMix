#!/bin/bash

# Simple Privacy Mixer Deployment Script
# Deploy PrivacyMixer contract to Starknet Mainnet with minimal testing parameters

set -e

echo "🚀 Deploying Privacy Mixer to Starknet Mainnet"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
PROFILE="mainnet"
ACCOUNT="privacy_mixer_deployer"
STRK_TOKEN="0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"
CLASS_HASH="0x00abc35fe33a082fad61df2a88160f16202d1a08cc338f1954063320063be4d5"

# Use the known deployer address
DEPLOYER_ADDRESS="0x01734203d1C5B2699B3dbC50223c86EC59E2B79E2d34CBE8363F0dCCdC1E9634"

echo -e "${YELLOW}📋 Deployment Info:${NC}"
echo "  Profile: $PROFILE"
echo "  Account: $ACCOUNT"
echo "  Deployer: $DEPLOYER_ADDRESS"
echo "  STRK Token: $STRK_TOKEN"
echo "  Class Hash: $CLASS_HASH"
echo ""
echo -e "${YELLOW}📝 Contract Parameters (Ultra-Minimal Testing):${NC}"
echo "  Min Deposit: 1 STRK"
echo "  Max Deposit: 100 STRK"
echo "  Mixing Fee: 0.01% (1 basis point)"
echo "  Min Anonymity: 0 (no requirement)"
echo "  Min Delay: 4 seconds"
echo ""

# Deploy contract
echo -e "${YELLOW}🚀 Deploying PrivacyMixer...${NC}"

RESULT=$(sncast --profile $PROFILE deploy \
    --class-hash $CLASS_HASH \
    --constructor-calldata \
        $DEPLOYER_ADDRESS \
        $STRK_TOKEN \
        1000000000000000000 \
        100000000000000000000 \
        1 \
        0 \
        4 \
    2>&1)

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Deployment failed${NC}"
    echo "$RESULT"
    exit 1
fi

# Extract contract address (macOS compatible)
CONTRACT_ADDRESS=$(echo "$RESULT" | grep 'contract_address:' | sed 's/.*contract_address: //' | cut -d' ' -f1)

echo -e "${GREEN}✅ PrivacyMixer deployed successfully!${NC}"
echo ""
echo -e "${YELLOW}📋 Deployment Summary:${NC}"
echo "  Contract Address: $CONTRACT_ADDRESS"
echo "  Owner: $DEPLOYER_ADDRESS"
echo "  Block Explorer: https://starkscan.co/contract/$CONTRACT_ADDRESS"
echo ""
echo -e "${YELLOW}🔧 Environment Variable:${NC}"
echo "MIXER_CONTRACT_ADDRESS=$CONTRACT_ADDRESS"
echo ""
echo -e "${GREEN}🎉 Ready for testing!${NC}"