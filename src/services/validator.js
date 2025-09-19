import { BlockchainService } from "./blockchain.js";
import { CacheService } from "./cache.js";
import { Logger } from "../utils/logger.js";

export class ValidatorService {
  constructor() {
    this.logger = new Logger('ValidatorService');
    this.cache = new CacheService('validators');
  }

  async getValidatorInfo(validatorAddress) {
    const cacheKey = `validator_info_${validatorAddress}`;
    
    try {
      // Check cache first
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;

      const contract = BlockchainService.getContract();
      const info = await contract.getValidatorInfo(validatorAddress);
      
      const result = {
        rewardAddress: info[0],
        status: Number(info[1]),
        stakingAmount: BlockchainService.formatEther(info[2]),
        commissionRate: BlockchainService.formatEther(info[3]),
        rewardAmount: BlockchainService.formatEther(info[4]),
        slashAmount: BlockchainService.formatEther(info[5]),
        stakers: info[6] || []
      };

      // Cache result
      this.cache.set(cacheKey, result);
      return result;

    } catch (error) {
      this.logger.error(`Failed to get validator info for ${validatorAddress}:`, error);
      throw error;
    }
  }

  async getValidatorDescription(validatorAddress) {
    const cacheKey = `validator_desc_${validatorAddress}`;
    
    try {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;

      const contract = BlockchainService.getContract();
      const desc = await contract.getValidatorDescription(validatorAddress);
      
      const result = {
        moniker: desc[0] || 'Unknown',
        website: desc[1] || '',
        email: desc[2] || '',
        details: desc[3] || ''
      };

      this.cache.set(cacheKey, result);
      return result;

    } catch (error) {
      this.logger.error(`Failed to get validator description for ${validatorAddress}:`, error);
      return {
        moniker: 'Unknown',
        website: '',
        email: '',
        details: ''
      };
    }
  }

  async getActivatedValidators() {
    const cacheKey = 'activated_validators';
    
    try {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;

      const contract = BlockchainService.getContract();
      const validators = await contract.getActivatedValidators();
      const result = validators.map(addr => BlockchainService.parseAddress(addr));
      
      this.cache.set(cacheKey, result);
      return result;

    } catch (error) {
      this.logger.error('Failed to get activated validators:', error);
      throw error;
    }
  }

  async getValidatorCandidates() {
    const cacheKey = 'validator_candidates';
    
    try {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;

      const contract = BlockchainService.getContract();
      const candidates = await contract.getValidatorCandidate();
      
      const result = {
        validators: candidates[0].map(addr => BlockchainService.parseAddress(addr)),
        stakingAmounts: candidates[1].map(amount => BlockchainService.formatEther(amount)),
        totalCount: Number(candidates[2])
      };
      
      this.cache.set(cacheKey, result);
      return result;

    } catch (error) {
      this.logger.error('Failed to get validator candidates:', error);
      throw error;
    }
  }

  async getTotalStaking() {
    const cacheKey = 'total_staking';
    
    try {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;

      const contract = BlockchainService.getContract();
      const total = await contract.totalStaking();
      const result = BlockchainService.formatEther(total);
      
      this.cache.set(cacheKey, result);
      return result;

    } catch (error) {
      this.logger.error('Failed to get total staking:', error);
      throw error;
    }
  }

  async isValidatorJailed(validatorAddress) {
    try {
      const contract = BlockchainService.getContract();
      return await contract.isJailed(validatorAddress);
    } catch (error) {
      this.logger.error(`Failed to check if validator is jailed ${validatorAddress}:`, error);
      return false;
    }
  }

  async isValidatorActivated(validatorAddress) {
    try {
      const contract = BlockchainService.getContract();
      return await contract.isValidatorActivated(validatorAddress);
    } catch (error) {
      this.logger.error(`Failed to check if validator is activated ${validatorAddress}:`, error);
      return false;
    }
  }

  async isValidatorCandidate(validatorAddress) {
    try {
      const contract = BlockchainService.getContract();
      return await contract.isValidatorCandidate(validatorAddress);
    } catch (error) {
      this.logger.error(`Failed to check if validator is candidate ${validatorAddress}:`, error);
      return false;
    }
  }

  async getContractConstants() {
    const cacheKey = 'contract_constants';
    
    try {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;

      const contract = BlockchainService.getContract();
      
      const [
        blockEpoch,
        maxValidatorNum,
        minimalStaking,
        stakingLockPeriod,
        withdrawRewardPeriod,
        validatorSlashAmount,
        defaultCommissionRate,
        maxCommissionRate
      ] = await Promise.all([
        contract.BlockEpoch(),
        contract.MaxValidatorNum(),
        contract.MinimalOfStaking(),
        contract.StakingLockPeriod(),
        contract.WithdrawRewardPeriod(),
        contract.ValidatorSlashAmount(),
        contract.DEFAULT_COMMISSION_RATE(),
        contract.MAX_COMMISSION_RATE()
      ]);

      const result = {
        blockEpoch: Number(blockEpoch),
        maxValidatorNum: Number(maxValidatorNum),
        minimalStaking: BlockchainService.formatEther(minimalStaking),
        stakingLockPeriod: Number(stakingLockPeriod),
        withdrawRewardPeriod: Number(withdrawRewardPeriod),
        validatorSlashAmount: BlockchainService.formatEther(validatorSlashAmount),
        defaultCommissionRate: BlockchainService.formatEther(defaultCommissionRate),
        maxCommissionRate: BlockchainService.formatEther(maxCommissionRate)
      };

      this.cache.set(cacheKey, result, 300000); // Cache for 5 minutes
      return result;

    } catch (error) {
      this.logger.error('Failed to get contract constants:', error);
      throw error;
    }
  }

  async getValidatorDetails(validatorAddress) {
    try {
      const address = BlockchainService.parseAddress(validatorAddress);
      
      const [info, description, isJailed, isActivated, isCandidate] = await Promise.all([
        this.getValidatorInfo(address),
        this.getValidatorDescription(address),
        this.isValidatorJailed(address),
        this.isValidatorActivated(address),
        this.isValidatorCandidate(address)
      ]);

      return {
        address,
        ...info,
        ...description,
        isJailed,
        isActivated,
        isCandidate,
        totalStakers: info.stakers ? info.stakers.length : 0,
        votingPower: parseFloat(info.stakingAmount)
      };

    } catch (error) {
      this.logger.error(`Failed to get validator details for ${validatorAddress}:`, error);
      throw error;
    }
  }

  async getAllValidatorsWithDetails(options = {}) {
    const { 
      page = 1, 
      limit = 20, 
      sortBy = 'stakingAmount', 
      sortOrder = 'desc' 
    } = options;

    try {
      const validators = await this.getActivatedValidators();
      
      // Get details for all validators
      const validatorDetails = await Promise.all(
        validators.map(address => this.getValidatorDetails(address))
      );

      // Sort validators
      validatorDetails.sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
        }
        
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortOrder === 'desc' 
            ? bVal.localeCompare(aVal) 
            : aVal.localeCompare(bVal);
        }
        
        return 0;
      });

      // Paginate
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedValidators = validatorDetails.slice(startIndex, endIndex);

      return {
        validators: paginatedValidators,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(validatorDetails.length / limit),
          totalItems: validatorDetails.length,
          itemsPerPage: limit
        }
      };

    } catch (error) {
      this.logger.error('Failed to get all validators with details:', error);
      throw error;
    }
  }

  async searchValidators(searchTerm) {
    if (!searchTerm || searchTerm.length < 2) {
      throw new Error('Search term must be at least 2 characters long');
    }

    try {
      const validators = await this.getActivatedValidators();
      const searchResults = [];
      const term = searchTerm.toLowerCase();

      for (const address of validators) {
        const [info, description] = await Promise.all([
          this.getValidatorInfo(address),
          this.getValidatorDescription(address)
        ]);

        if (
          address.toLowerCase().includes(term) ||
          description.moniker.toLowerCase().includes(term) ||
          description.details.toLowerCase().includes(term) ||
          description.website.toLowerCase().includes(term)
        ) {
          searchResults.push({
            address,
            ...info,
            ...description,
            totalStakers: info.stakers ? info.stakers.length : 0
          });
        }

        // Limit search results
        if (searchResults.length >= 10) break;
      }

      return searchResults;

    } catch (error) {
      this.logger.error(`Failed to search validators with term "${searchTerm}":`, error);
      throw error;
    }
  }

  // Clear specific cache entries
  clearCache(key) {
    this.cache.delete(key);
  }

  // Clear all cache
  clearAllCache() {
    this.cache.clear();
  }
}