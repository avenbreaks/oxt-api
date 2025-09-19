import { ethers } from "ethers";
import ValidatorsABI from "../abi/Validators.abi.json";

class BlockchainServiceClass {
  constructor() {
    this.provider = null;
    this.validatorsContract = null;
    this.isInitialized = false;
    this.config = {
      rpcUrl: process.env.RPC_URL || 'https://rpc.adera.network',
      contractAddress: process.env.VALIDATORS_CONTRACT_ADDRESS || '0x1234567890123456789012345678901234567890'
    };
  }

  async initialize() {
    try {
      // Initialize provider
      this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
      
      // Test connection
      await this.provider.getNetwork();
      console.log('✅ Provider connected successfully');

      // Initialize contract
      this.validatorsContract = new ethers.Contract(
        this.config.contractAddress,
        ValidatorsABI,
        this.provider
      );

      // Test contract call (simple view function)
      try {
        await this.validatorsContract.totalStaking();
        console.log('✅ Contract initialized successfully');
      } catch (contractError) {
        console.warn('⚠️ Contract test call failed, but connection established');
      }

      this.isInitialized = true;
      return true;

    } catch (error) {
      console.error('❌ Failed to initialize blockchain service:', error.message);
      // Don't throw error, allow app to start even if blockchain is not available
      return false;
    }
  }

  getProvider() {
    if (!this.provider) {
      this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
    }
    return this.provider;
  }

  getContract() {
    if (!this.validatorsContract) {
      this.validatorsContract = new ethers.Contract(
        this.config.contractAddress,
        ValidatorsABI,
        this.getProvider()
      );
    }
    return this.validatorsContract;
  }

  async getCurrentBlock() {
    try {
      return await this.getProvider().getBlockNumber();
    } catch (error) {
      console.error('Failed to get current block:', error);
      return 0;
    }
  }

  async getBlockTime(blockNumber = 'latest') {
    try {
      const block = await this.getProvider().getBlock(blockNumber);
      return block ? block.timestamp : Math.floor(Date.now() / 1000);
    } catch (error) {
      console.error('Failed to get block time:', error);
      return Math.floor(Date.now() / 1000);
    }
  }

  async getNetworkInfo() {
    try {
      const [network, blockNumber, blockTime] = await Promise.all([
        this.getProvider().getNetwork(),
        this.getCurrentBlock(),
        this.getBlockTime()
      ]);

      return {
        chainId: Number(network.chainId),
        name: network.name || 'Adera Network',
        currentBlock: blockNumber,
        blockTime: new Date(blockTime * 1000).toISOString()
      };
    } catch (error) {
      console.error('Failed to get network info:', error);
      return {
        chainId: 0,
        name: 'Unknown Network',
        currentBlock: 0,
        blockTime: new Date().toISOString()
      };
    }
  }

  // Utility methods
  formatEther(value) {
    try {
      return ethers.formatEther(value.toString());
    } catch (error) {
      return '0';
    }
  }

  parseAddress(address) {
    try {
      return ethers.getAddress(address);
    } catch (error) {
      throw new Error(`Invalid address: ${address}`);
    }
  }

  isValidAddress(address) {
    try {
      ethers.getAddress(address);
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const BlockchainService = new BlockchainServiceClass();