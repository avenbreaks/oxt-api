import { BlockchainService } from "./blockchain.js";
import { CacheService } from "./cache.js";

export class ValidatorService {
  constructor() {
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
      console.error(`Failed to get validator info for ${validatorAddress}:`, error);
      return {
        rewardAddress: '0x0000000000000000000000000000000000000000',
        status: 0,
        stakingAmount: '0',
        commissionRate: '0',
        rewardAmount: '0',
        slashAmount: '0',
        stakers: []
      };
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
      console.error(`Failed to get validator description for ${validatorAddress}:`, error);
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
      console.error('Failed to get activated validators:', error);
      // Return mock data for development
      return [
        '0x1234567890123456789012345678901234567890',
        '0x2345678901234567890123456789012345678901'
      ];
    }
  }

  async getValidatorDetails(validatorAddress) {
    const cacheKey = `validator_details_${validatorAddress}`;

    try {
      // Check cache first
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;

      // Get all validator information
      const [info, description, isJailed, isActivated] = await Promise.all([
        this.getValidatorInfo(validatorAddress),
        this.getValidatorDescription(validatorAddress),
        this.isValidatorJailed(validatorAddress),
        this.isValidatorActivated(validatorAddress)
      ]);

      const result = {
        address: validatorAddress,
        rewardAddr: info.rewardAddress,
        status: info.status,
        stakingAmount: info.stakingAmount,
        commissionRate: info.commissionRate,
        rewardAmount: info.rewardAmount,
        slashAmount: info.slashAmount,
        lastWithdrawRewardBlock: this.extractLastWithdrawBlock(info),
        stakers: info.stakers || [],
        isJailed,
        isActivated,
        description: {
          moniker: description.moniker,
          website: description.website,
          email: description.email,
          details: description.details
        },
        totalStakers: info.stakers ? info.stakers.length : 0
      };

      // Cache result for 30 seconds
      this.cache.set(cacheKey, result, 30000);
      return result;

    } catch (error) {
      console.error(`Failed to get validator details for ${validatorAddress}:`, error);
      throw new Error(`Failed to get validator details: ${error.message}`);
    }
  }

  // Helper method untuk extract last withdraw block dari contract response
  extractLastWithdrawBlock(info) {
    // Contract getValidatorInfo returns array, last withdraw block might be in different position
    // Adjust based on your contract structure
    try {
      const contract = BlockchainService.getContract();
      // This might need to be adjusted based on actual contract response structure
      return Number(info.lastWithdrawRewardBlock) || 0;
    } catch (error) {
      return 0;
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
      console.error('Failed to get validator candidates:', error);
      return {
        validators: [],
        stakingAmounts: [],
        totalCount: 0
      };
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
      console.error('Failed to get total staking:', error);
      return '1000000'; // Mock data
    }
  }

  async isValidatorJailed(validatorAddress) {
    try {
      const contract = BlockchainService.getContract();
      return await contract.isJailed(validatorAddress);
    } catch (error) {
      console.error(`Failed to check if validator is jailed ${validatorAddress}:`, error);
      return false;
    }
  }

  async isValidatorActivated(validatorAddress) {
    try {
      const contract = BlockchainService.getContract();
      return await contract.isValidatorActivated(validatorAddress);
    } catch (error) {
      console.error(`Failed to check if validator is activated ${validatorAddress}:`, error);
      return false;
    }
  }

  async getContractConstants() {
    const cacheKey = 'contract_constants';

    try {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;

      const contract = BlockchainService.getContract();

      // Get actual constants from contract
      const [
        withdrawRewardPeriod,
        stakingLockPeriod,
        minimalStaking,
        maxValidatorNum,
        defaultCommissionRate,
        maxCommissionRate
      ] = await Promise.all([
        contract.WithdrawRewardPeriod(),
        contract.StakingLockPeriod(),
        contract.MinimalOfStaking(),
        contract.MaxValidatorNum(),
        contract.DEFAULT_COMMISSION_RATE(),
        contract.MAX_COMMISSION_RATE()
      ]);

      const result = {
        withdrawRewardPeriod: Number(withdrawRewardPeriod),
        stakingLockPeriod: Number(stakingLockPeriod),
        minimalStaking: BlockchainService.formatEther(minimalStaking),
        maxValidatorNum: Number(maxValidatorNum),
        defaultCommissionRate: Number(defaultCommissionRate),
        maxCommissionRate: Number(maxCommissionRate)
      };

      this.cache.set(cacheKey, result, 300000); // Cache for 5 minutes
      return result;

    } catch (error) {
      console.error('Failed to get contract constants:', error);
      // Fallback to default values if contract call fails
      return {
        withdrawRewardPeriod: 28800, // blocks
        stakingLockPeriod: 86400,   // blocks
        minimalStaking: '1000',     // OXT
        maxValidatorNum: 101,
        defaultCommissionRate: 500, // basis points
        maxCommissionRate: 1000     // basis points
      };
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

      // Get details for validators (limit to avoid too many calls)
      const limitedValidators = validators.slice(0, Math.min(validators.length, 50));
      const validatorDetails = await Promise.all(
        limitedValidators.map(async (address) => {
          const [info, description, isJailed] = await Promise.all([
            this.getValidatorInfo(address),
            this.getValidatorDescription(address),
            this.isValidatorJailed(address)
          ]);

          return {
            address,
            ...info,
            ...description,
            isJailed,
            isActivated: true,
            isCandidate: false,
            totalStakers: info.stakers ? info.stakers.length : 0,
            votingPower: parseFloat(info.stakingAmount)
          };
        })
      );

      // Sort validators
      validatorDetails.sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
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
      console.error('Failed to get all validators with details:', error);
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

      // Limit search to first 10 validators to avoid too many calls
      const limitedValidators = validators.slice(0, 10);

      for (const address of limitedValidators) {
        const [info, description] = await Promise.all([
          this.getValidatorInfo(address),
          this.getValidatorDescription(address)
        ]);

        if (
          address.toLowerCase().includes(term) ||
          description.moniker.toLowerCase().includes(term) ||
          description.details.toLowerCase().includes(term)
        ) {
          searchResults.push({
            address,
            ...info,
            ...description,
            totalStakers: info.stakers ? info.stakers.length : 0
          });
        }

        if (searchResults.length >= 5) break;
      }

      return searchResults;

    } catch (error) {
      console.error(`Failed to search validators with term "${searchTerm}":`, error);
      throw error;
    }
  }

  // Clear cache methods
  clearCache(key) {
    this.cache.delete(key);
  }

  clearAllCache() {
    this.cache.clear();
  }
}