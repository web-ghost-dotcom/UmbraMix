# Privacy Strategy

## How We Protect You

UmbraMix employs a sophisticated privacy strategy designed to break the linkability of your transactions at multiple levels. By combining Starknet contracts, the Lightning Network, and Cashu ecash, we create a robust anonymity shield.

### Core Privacy Components

Our privacy strategy relies on three main pillars:

1.  **On-Chain Unlinkability**:
    - **Mixing**: Your funds are pooled with others in the Privacy Mixer contract. When you withdraw, the funds come from the pool, making it impossible to trace the origin.
    - **Splitting**: Amounts can be split into smaller denominations, further obfuscating the transaction trail.

2.  **Off-Chain Routing**:
    - **Lightning Network**: Transactions are routed through the Lightning Network, which is an off-chain layer on top of Bitcoin. Payments are instant and leave no trace on the public blockchain.
    - **Cashu Ecash**: Use verifyable ecash tokens that represent value but do not carry transaction history.

3.  **Behavioral Privacy**:
    - **Timing Delays**: Random delays are introduced between deposits and withdrawals to prevent timing analysis.
    - **Amount Obfuscation**: Amounts are often broken down or standardized to avoid easy identification.

### Graph Analysis Resistance

Blockchain analysis tools rely on building transaction graphs to link addresses. UmbraMix breaks these graphs:

-   **Deposit**: You send funds to the mixer contract (Graph: You -> Mixer).
-   **Withdrawal**: Mixer sends funds to your recipient (Graph: Mixer -> Recipient).
-   **Direct Link Broken**: Without internal mixer logs (which are not kept), there is no direct link between "You" and "Recipient" on-chain.

### Best Practices for Users

To maximize your privacy, consider the following:

-   **Use Fresh Addresses**: Always withdraw to a new, unused address.
-   **Mix at Different Times**: Avoid predictable patterns.
-   **Avoid exact amounts**: If you deposit 100 STRK, try withdrawing 95 STRK or multiple small amounts.
-   **Browser Hygiene**: Use privacy-focused browsers or extensions to prevent IP tracking.

### Limitations

While UmbraMix provides strong privacy guarantees, it is not a magic bullet. Users should be aware of potential metadata leaks (IP addresses, browser fingerprints) and ensure they follow best practices.
