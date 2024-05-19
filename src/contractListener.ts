import { TransactionReceipt, ethers } from 'ethers';
import { Erc20Token } from './types';

const erc20Abi = [
    // Minimal ERC-20 ABI
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)",
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint256)"
];

class ContractCreationListener {
    private provider: ethers.Provider;
    private running: boolean;
    private blockHandler: (blockNumber: number) => Promise<void>;

    constructor(providerUrl: string) {
        this.provider = new ethers.JsonRpcProvider(providerUrl);
        this.running = false;

        this.blockHandler = async (blockNumber: number) => {
            console.log(`New block: ${blockNumber}`);
            try {
                const block = await this.provider.getBlock(blockNumber);
                if (block) {
                    const txs = await Promise.all(block.transactions.map(hash => this.provider.getTransaction(hash)));
                    for (const tx of txs) {
                        if (tx && !tx.to) {
                            const receipt = await this.provider.getTransactionReceipt(tx.hash);
                            if (receipt && receipt.contractAddress) {
                                console.log(`New contract created at address: ${receipt.contractAddress}`);
                                this.processContract(receipt);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error(`Error processing block ${blockNumber}:`, error);
            }
        };
    }

    public start(): void {
        if (!this.running) {
            this.running = true;
            this.provider.on('block', this.blockHandler);
            console.log('Listener started.');
        }
    }

    public stop(): void {
        if (this.running) {
            this.running = false;
            this.provider.off('block', this.blockHandler);
            console.log('Listener stopped.');
        }
    }

    public async checkBlock(blockNumber: number): Promise<void>{
        await this.blockHandler(blockNumber);
    }

    private async processContract(receipt: TransactionReceipt): Promise<void> {
        try {
            // Check if the contract conforms to ERC-20, and if so, get relevant information
            const contract = new ethers.Contract(receipt.contractAddress ?? "", erc20Abi, this.provider);

            const totalSupplyRaw = await contract.totalSupply();
            const decimals = await contract.decimals();

            // Convert to BigInt and adjust for decimals
            const totalSupply = BigInt(totalSupplyRaw.toString());
            const adjustedTotalSupply = (totalSupply / BigInt(10) ** BigInt(decimals)).toString();

            const name = await contract.name();
            const symbol = await contract.symbol();

            const foundContract: Erc20Token = {
                address: receipt.contractAddress ?? "",
                name: name,
                symbol: symbol,
                totalSupply: adjustedTotalSupply,
                decimals: decimals,
                deployer: receipt.from
            }
            console.log(foundContract);
            // Do something with this found contract here, like posting it to a Telegram or Discord channel, for example
        } catch (error) {
            // If any of the operations fail, it may not be a valid ERC-20 contract at the time of deployment
            // Optionally log this error
            // console.error(`Error checking ERC-20 contract at address ${receipt.contractAddress ?? ""}:`, error);
        }
    }
}

const listener = new ContractCreationListener('https://eth.llamarpc.com');
//Start listening to new blocks
listener.start();

//Check specific block for deployments
//listener.checkBlock(14029867)