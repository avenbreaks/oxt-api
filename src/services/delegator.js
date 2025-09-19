import { BlockchainService } from "./blockchain.js";
import { ValidatorService } from "./validator.js";
import { CacheService } from "./cache.js";
import { Logger } from "../utils/logger.js";

export class DelegatorService {
  constructor() {
    this.logger = new Logger('DelegatorService');
    this.cache = new CacheService('delegators');
    this.validatorService = new ValidatorService();
  }

  async getStakingInfo(stakerAddress, validatorAddress) {
    const cacheKey = `staking_info_${stakerAddress}_${validatorAddress}`;
    
    try {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;

      const contract = BlockchainService.getContract();
      const info = await contract.getStakingInfo(stakerAddress, validatorAddress);
      
      const result = {
        stakedAmount: BlockchainService.formatEther(info[0]),
        unstakeBlock: Number(info[1]),
        lastClaimBlock: Number(info[2])
      };

      // Cache for shorter duration since this data changes frequently
      this.cache.set(cacheKey, result, 10000); // 10 seconds
      return result;

    } catch (error) {
      this.logger.error(`Failed to get staking info for ${stakerAddress} -> ${validatorAddress}:`, error);
      return {
        stakedAmount: '0',
        unstakeBlock: 0,
        lastClaimBlock: 0
      };
    }
  }

  async getPendingRewards(delegatorAddress, validatorAddress) {
    const cacheKey = `pending_rewards_${delegatorAddress}_${validatorAddress}`;
    
    try {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;

      const contract = BlockchainService.getContract();
      const rewards = await contract.getPendingDelegatorRewards(
        delegatorAddress, 
        validatorAddress
      );
      
      const result = BlockchainService.formatEther(rewards);
      this.cache.set(cacheKey, result, 5000); // 5 seconds cache
      return result;

    } catch (error) {
      this.logger.error(`Failed to get pending rewards for ${delegatorAddress} -> ${validatorAddress}:`, error);
      return '0';
    }
  }

  async getDelegatorRewardInfo(delegatorAddress, validatorAddress) {
    const cacheKey = `delegator_reward_info_${delegatorAddress}_${validatorAddress}`;
    
    try {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;

      const contract = BlockchainService.getContract();
      const info = await contract.delegatorRewardInfo(
        delegatorAddress, 
        validatorAddress
      );
      
      const result = {
        rewardDebt: BlockchainService.formatEther(info[0]),
        pendingRewards: BlockchainService.formatEther(info[1]),
        lastClaimBlock: Number(info[2])
      };

      this.cache.set(cacheKey, result, 10000);
      return result;

    } catch (error) {
      this.logger.error(`Failed to get delegator reward info for ${delegatorAddress} -> ${validatorAddress}:`, error);
      return {
        rewardDebt: '0',
        pendingRewards: '0',
        lastClaimBlock: 0
      };
    }
  }

  async getStakerInfo(stakerAddress, validatorAddress) {
    try {
      const contract = BlockchainService.getContract();
      const info = await contract.stakerInfo(stakerAddress, validatorAddress);
      
      return {
        amount: BlockchainService.formatEther(info[0]),
        unstakeBlock: Number(info[1]),
        index: Number(info[2])
      };

    } catch (error) {
      this.logger.error(`Failed to get staker info for ${stakerAddress} -> ${validatorAddress}:`, error);
      return {
        amount: '0',
        unstakeBlock: 0,
        index: 0
      };
    }
  }

  async getDelegatorInfo(delegatorAddress, options = {}) {
    try {
      const address = BlockchainService.parseAddress(delegatorAddress);
      const { includeInactive = false } = options;
      
      // Get all validators to check delegations
      const validators = await this.validatorService.getActivatedValidators();
      const currentBlock = await BlockchainService.getCurrentBlock();
      
      // Get delegation info for each validator
      const delegationPromises = validators.map(async (validatorAddress) => {
        const [stakingInfo, rewardInfo, pendingRewards] = await Promise.all([
          this.getStakingInfo(address, validatorAddress),
          this.getDelegatorRewardInfo(address, validatorAddress),
          this.getPendingRewards(address, validatorAddress)
        ]);

        // Only include if there's an active delegation or if requested
        if (parseFloat(stakingInfo.stakedAmount) > 0 || includeInactive) {
          const validatorDesc = await this.validatorService.getValidatorDescription(validatorAddress);
          const validatorInfo = await this.validatorService.getValidatorInfo(validatorAddress);
          
          // Check if can withdraw
          const canWithdraw = stakingInfo.unstakeBlock > 0 && 
                             stakingInfo.unstakeBlock <= currentBlock;
          
          // Calculate blocks until withdrawal
          const blocksUntilWithdraw = stakingInfo.unstakeBlock > currentBlock ? 
                                    stakingInfo.unstakeBlock - currentBlock : 0;

          return {
            validatorAddress,
            validatorMoniker: validatorDesc.moniker,
            validatorCommission: parseFloat(validatorInfo.commissionRate),
            validatorStatus: validatorInfo.status,
            ...stakingInfo,
            ...rewardInfo,
            pendingRewards,
            canWithdraw,
            blocksUntilWithdraw,
            isActive: parseFloat(stakingInfo.stakedAmount) > 0
          };
        }
        return null;
      });

      const delegations = (await Promise.all(delegationPromises))
        .filter(delegation => delegation !== null);

      // Calculate summary statistics
      const activeDelegations = delegations.filter(d => d.isActive);
      const totalStaked = activeDelegations.reduce((sum, d) => 
        sum + parseFloat(d.stakedAmount), 0
      );
      const totalRewards = activeDelegations.reduce((sum, d) => 
        sum + parseFloat(d.pendingRewards), 0
      );
      const totalCanWithdraw = delegations.filter(d => d.canWithdraw).length;
      const averageCommission = activeDelegations.length > 0 ? 
        activeDelegations.reduce((sum, d) => sum + d.validatorCommission, 0) / activeDelegations.length : 0;

      return {
        delegatorAddress: address,
        delegations,
        summary: {
          totalStaked: totalStaked.toFixed(6),
          totalPendingRewards: totalRewards.toFixed(6),
          activeDelegationsCount: activeDelegations.length,
          totalDelegationsCount: delegations.length,
          readyToWithdrawCount: totalCanWithdraw,
          averageCommission: averageCommission.toFixed(4)
        },
        meta: {
          currentBlock,
          lastUpdated: new Date().toISOString()
        }
      };

    } catch (error) {
      this.logger.error(`Failed to get delegator info for ${delegatorAddress}:`, error);
      throw error;
    }
  }

  async getStakingDetails(delegatorAddress, validatorAddress) {
    try {
      const delegatorAddr = BlockchainService.parseAddress(delegatorAddress);
      const validatorAddr = BlockchainService.parseAddress(validatorAddress);
      
      const [
        stakingInfo, 
        rewardInfo, 
        pendingRewards, 
        validatorInfo, 
        currentBlock,
        stakingLockPeriod
      ] = await Promise.all([
        this.getStakingInfo(delegatorAddr, validatorAddr),
        this.getDelegatorRewardInfo(delegatorAddr, validatorAddr),
        this.getPendingRewards(delegatorAddr, validatorAddr),
        this.validatorService.getValidatorInfo(validatorAddr),
        BlockchainService.getCurrentBlock(),
        BlockchainService.getContract().then(c => c.StakingLockPeriod())
      ]);

      const canWithdraw = stakingInfo.unstakeBlock > 0 && 
                         stakingInfo.unstakeBlock <= currentBlock;
      const blocksUntilWithdraw = stakingInfo.unstakeBlock > currentBlock ? 
                                 stakingInfo.unstakeBlock - currentBlock : 0;

      return {
        delegator: delegatorAddr,
        validator: validatorAddr,
        staking: {
          ...stakingInfo,
          canWithdraw,
          blocksUntilWithdraw,
          estimatedWithdrawTime: blocksUntilWithdraw > 0 ? 
            new Date(Date.now() + (blocksUntilWithdraw * 3000)).toISOString() : // Assuming 3s block time
            null
        },
        rewards: {
          ...rewardInfo,
          pendingRewards,
          validatorCommission: validatorInfo.commissionRate
        },
        network: {
          currentBlock,
          stakingLockPeriod: Number(stakingLockPeriod)
        }
      };

    } catch (error) {
      this.logger.error(`Failed to get staking details for ${delegatorAddress} -> ${validatorAddress}:`, error);
      throw error;
    }
  }

  async getDelegatorHistory(delegatorAddress, options = {}) {
    try {
      const address = BlockchainService.parseAddress(delegatorAddress);
      const { limit = 50, includeEvents = false } = options;
      
      // Note: This would require event filtering which needs more complex implementation
      // For now, return current state with placeholder for historical data
      
      const currentInfo = await this.getDelegatorInfo(address);
      
      return {
        delegatorAddress: address,
        current: currentInfo,
        history: [], // Would be populated with historical events
        events: includeEvents ? [] : undefined, // Would include stake/unstake/claim events
        pagination: {
          limit,
          hasMore: false
        }
      };

    } catch (error) {
      this.logger.error(`Failed to get delegator history for ${delegatorAddress}:`, error);
      throw error;
    }
  }

  async getDelegatorStatistics() {
    try {
      // This would require aggregating data across all delegators
      // For now, return basic statistics
      
      const validators = await this.validatorService.getActivatedValidators();
      let totalDelegators = 0;
      let totalDelegatedAmount = 0;
      
      // Get total staking amount
      const totalStaking = await this.validatorService.getTotalStaking();
      
      // Estimate delegator count (this is simplified - would need better tracking)
      const validatorDetails = await Promise.all(
        validators.map(addr => this.validatorService.getValidatorInfo(addr))
      );
      
      totalDelegators = validatorDetails.reduce((sum, info) => 
        sum + (info.stakers ? info.stakers.length : 0), 0
      );
      
      return {
        totalDelegators: Math.max(totalDelegators, 0), // Avoid negative numbers
        totalDelegatedAmount: totalStaking,
        averageDelegationSize: totalDelegators > 0 ? 
          (parseFloat(totalStaking) / totalDelegators).toFixed(6) : '0',
        activeValidators: validators.length,
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to get delegator statistics:', error);
      throw error;
    }
  }

  // Utility methods
  async canWithdrawStaking(delegatorAddress, validatorAddress) {
    try {
      const stakingInfo = await this.getStakingInfo(delegatorAddress, validatorAddress);
      const currentBlock = await BlockchainService.getCurrentBlock();
      
      return stakingInfo.unstakeBlock > 0 && stakingInfo.unstakeBlock <= currentBlock;
    } catch (error) {
      this.logger.error('Failed to check withdrawal status:', error);
      return false;
    }
  }

  async getWithdrawalStatus(delegatorAddress, validatorAddress) {
    try {
      const stakingInfo = await this.getStakingInfo(delegatorAddress, validatorAddress);
      const currentBlock = await BlockchainService.getCurrentBlock();
      
      if (stakingInfo.unstakeBlock === 0) {
        return { status: 'staked', canWithdraw: false, blocksRemaining: 0 };
      }
      
      if (stakingInfo.unstakeBlock <= currentBlock) {
        return { status: 'ready', canWithdraw: true, blocksRemaining: 0 };
      }
      
      return { 
        status: 'pending', 
        canWithdraw: false, 
        blocksRemaining: stakingInfo.unstakeBlock - currentBlock,
        estimatedTime: new Date(Date.now() + ((stakingInfo.unstakeBlock - currentBlock) * 3000)).toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to get withdrawal status:', error);
      return { status: 'unknown', canWithdraw: false, blocksRemaining: 0 };
    }
  }

  // Clear cache methods
  clearDelegatorCache(delegatorAddress) {
    const keys = this.cache.keys().filter(key => key.includes(delegatorAddress));
    keys.forEach(key => this.cache.delete(key));
  }

  clearAllCache() {
    this.cache.clear();
  }
}