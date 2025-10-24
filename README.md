# 🌍 Peer-to-Peer Pharmaceutical Surplus Redistribution Network for Disaster Relief

Welcome to a decentralized solution for redistributing surplus pharmaceuticals during disasters! This Web3 project leverages the Stacks blockchain and Clarity smart contracts to enable transparent, trustless peer-to-peer sharing of medications, ensuring they reach those in need quickly and efficiently while minimizing waste and fraud.

In disaster scenarios—like earthquakes, floods, or pandemics—pharmaceutical surpluses in unaffected areas often go unused, while affected regions face critical shortages. Traditional systems suffer from bureaucratic delays, lack of transparency, and verification challenges. This network solves that by using blockchain to match donors with recipients, track shipments immutably, and verify authenticity, all without intermediaries.

## ✨ Features

🔄 Peer-to-peer matching of surplus meds to disaster needs  
📦 Immutable tracking of inventory, requests, and transfers  
✅ Verification of drug authenticity, expiry, and quality via on-chain proofs  
🛡️ Escrow mechanisms to ensure safe handovers  
🏆 Incentive tokens for donors and verifiers to encourage participation  
🌐 Governance for community-driven updates and dispute resolution  
🚨 Emergency alerts for urgent requests  
🔒 Privacy-preserving user registration for NGOs, governments, and individuals  
📊 Analytics for real-time surplus/demand insights  

## 🛠 How It Works

This project consists of 8 interconnected Clarity smart contracts deployed on the Stacks blockchain, enabling a secure and scalable network. Here's a high-level overview:

### Key Smart Contracts
1. **UserRegistry.clar**: Handles registration and authentication of users (donors, recipients, verifiers like NGOs). Stores hashed identities and roles for privacy.
2. **InventoryManager.clar**: Allows donors to list surplus pharmaceuticals, including details like drug name, quantity, expiry date, and a hash of certification documents.
3. **RequestManager.clar**: Enables recipients in disaster areas to post needs, specifying required meds, quantities, locations, and urgency levels.
4. **MatchingEngine.clar**: Automates matching of inventories to requests based on criteria like proximity, expiry, and priority; emits events for matches.
5. **EscrowTransfer.clar**: Manages secure transfers using escrow—locks funds or tokens until verification of delivery, releasing upon confirmation.
6. **VerificationOracle.clar**: Integrates off-chain verifiers (e.g., via oracles) to confirm drug quality and shipment status, storing proofs on-chain.
7. **IncentiveToken.clar**: A fungible token contract (using SIP-010 standard) to reward donors and verifiers, minted upon successful redistributions.
8. **GovernanceDAO.clar**: Allows token holders to propose and vote on network upgrades, fee structures, or dispute resolutions.

**For Donors**  
- Register via UserRegistry.  
- Add surplus meds to InventoryManager with details and proofs.  
- When a match is found via MatchingEngine, initiate a transfer through EscrowTransfer.  
- Earn incentive tokens upon verified delivery.

**For Recipients**  
- Register and post requests in RequestManager, including geolocation data.  
- Accept matches and coordinate off-chain logistics.  
- Confirm receipt to release escrow and trigger rewards.

**For Verifiers (e.g., NGOs or Authorities)**  
- Use VerificationOracle to submit on-chain proofs of inspections or deliveries.  
- Participate in GovernanceDAO for network oversight.

**Technical Flow**  
1. A donor lists inventory—hashed data ensures tamper-proof records.  
2. A recipient posts a request; MatchingEngine scans for fits and notifies parties.  
3. EscrowTransfer holds stakes (e.g., tokens or STX) until VerificationOracle confirms success.  
4. Successful transfers mint tokens via IncentiveToken and update governance metrics.  