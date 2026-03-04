// Starknet bridge abstraction
export interface StarknetBridge {
    deposit(amount: string, address: string): Promise<{ txHash: string }>; // deposit into mixer
    withdraw(amount: string, address: string): Promise<{ txHash: string }>; // withdraw to user
}

export class MockStarknetBridge implements StarknetBridge {
    async deposit(_amount: string, _address: string): Promise<{ txHash: string }> {
        return { txHash: 'stark_dep_' + Date.now() };
    }
    async withdraw(_amount: string, _address: string): Promise<{ txHash: string }> {
        return { txHash: 'stark_wd_' + Date.now() };
    }
}
