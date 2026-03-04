# Cryptography

## Zero-Knowledge & Commitments

At the heart of UmbraMix lies advanced cryptography designed to provide security without sacrificing privacy. This document outlines the cryptographic primitives used by our system.

### Cryptographic Primitives

UmbraMix utilizes the following key cryptographic concepts:

1.  **Pedersen Commitments**:
    - **What**: A commitment scheme that allows you to hide a value (amount) while committing to it.
    - **Why**: Ensures that once a user deposits an amount, they cannot change it, but the committed amount itself remains confidential.

2.  **Zero-Knowledge Proofs (ZKPs)**:
    - **What**: A method to prove that you possess a secret (the private key for a commitment) without revealing the secret itself.
    - **Why**: Allows users to withdraw funds by proving ownership of a previously made deposit without revealing which deposit it corresponds to, maintaining anonymity.

3.  **Blind Signatures (Chaumian Ecash)**:
    - **What**: Used in the Cashu layer. A user obtains a "blinded" token from the mint. The mint signs it without seeing the content.
    - **Why**: Even the mint cannot link the token issuance to its redemption. This provides strong unlinkability between the user and the mint.

### Security Model

UmbraMix's security model assumes:

-   **Honest Majority**: The underlying Starknet and Bitcoin/Lightning networks are secure.
-   **Computational Limitations**: Adversaries cannot break standard cryptographic assumptions (discrete log, hash functions).
-   **Trusted Setup (N/A)**: Our system avoids trusted setups where possible, relying on transparent and verifiable cryptographic parameters.

### Auditable Security

All smart contracts are open-source and undergo rigorous auditing. The cryptographic protocols are based on well-established standards and have generally accepted security proofs.

-   **Repo**: The source code is available on [GitHub](https://github.com/umbramix/umbramix-core).
-   **Audits**: [Audit Reports](/docs/audits) are available for review.

### Randomness

Randomness is crucial for privacy (e.g., in generating blinding factors, delays). UmbraMix uses secure sources of randomness, both on-chain (via verifiable random functions where applicable) and client-side (browser crypto API).
