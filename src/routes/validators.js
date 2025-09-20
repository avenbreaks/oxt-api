import { Elysia, t } from "elysia";
import { ValidatorService } from "../services/validator.js";
import { responseWrapper } from "../utils/response.js";
import { validateAddress } from "../utils/validation.js";
import { BlockchainService } from "../services/blockchain.js";

const validatorService = new ValidatorService();

export const validatorRoutes = new Elysia({ prefix: '/api/validators' })
  
  // Get all validators with pagination and filtering
  .get('/', async ({ query }) => {
    try {
      const options = {
        page: parseInt(query.page) || 1,
        limit: Math.min(parseInt(query.limit) || 20, 100),
        sortBy: query.sortBy || 'stakingAmount',
        sortOrder: query.sortOrder || 'desc'
      };

      const result = await validatorService.getAllValidatorsWithDetails(options);
      
      return responseWrapper.success(result);
      
    } catch (error) {
      return responseWrapper.error(error.message);
    }
  }, {
    query: t.Object({
      page: t.Optional(t.Numeric()),
      limit: t.Optional(t.Numeric()),
      sortBy: t.Optional(t.String()),
      sortOrder: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')]))
    })
  })

  // Get validator candidates
  .get('/candidates', async ({ query }) => {
    try {
      const page = parseInt(query.page) || 1;
      const limit = Math.min(parseInt(query.limit) || 20, 100);

      const candidates = await validatorService.getValidatorCandidates();
      
      // Get detailed info for candidates
      const candidateDetails = await Promise.all(
        candidates.validators.map(async (address, index) => {
          const [description, isActivated, isJailed] = await Promise.all([
            validatorService.getValidatorDescription(address),
            validatorService.isValidatorActivated(address),
            validatorService.isValidatorJailed(address)
          ]);
          
          return {
            address,
            stakingAmount: candidates.stakingAmounts[index],
            rank: index + 1,
            ...description,
            isActivated,
            isJailed
          };
        })
      );

      // Paginate candidates
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedCandidates = candidateDetails.slice(startIndex, endIndex);

      return responseWrapper.success({
        candidates: paginatedCandidates,
        totalCount: candidates.totalCount,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(candidateDetails.length / limit),
          totalItems: candidateDetails.length,
          itemsPerPage: limit
        }
      });

    } catch (error) {
      return responseWrapper.error(error.message);
    }
  }, {
    query: t.Object({
      page: t.Optional(t.Numeric()),
      limit: t.Optional(t.Numeric())
    })
  })

  // Search validators
  .get('/search', async ({ query }) => {
    try {
      const searchTerm = query.q;
      
      if (!searchTerm || searchTerm.length < 2) {
        return responseWrapper.error('Search term must be at least 2 characters long');
      }

      const results = await validatorService.searchValidators(searchTerm);
      
      return responseWrapper.success({
        results,
        searchTerm,
        totalFound: results.length
      });

    } catch (error) {
      return responseWrapper.error(error.message);
    }
  }, {
    query: t.Object({
      q: t.String({ minLength: 2 })
    })
  })

  // Get specific validator details
  .get('/:address', async ({ params }) => {
    try {
      const { address } = params;
      
      if (!validateAddress(address)) {
        return responseWrapper.error('Invalid validator address');
      }

      const validatorDetails = await validatorService.getValidatorDetails(address);
      const constants = await validatorService.getContractConstants();
      const currentBlock = await BlockchainService.getCurrentBlock();
      const canWithdrawRewards = validatorDetails.lastWithdrawRewardBlock ? 
        (currentBlock - validatorDetails.lastWithdrawRewardBlock) >= constants.withdrawRewardPeriod : 
        true;

      return responseWrapper.success({
        ...validatorDetails,
        canWithdrawRewards,
        performance: {
          uptime: validatorDetails.isJailed ? '0%' : '100%',
          missedBlocks: 0,
          lastWithdrawRewardBlock: validatorDetails.lastWithdrawRewardBlock || 0
        },
        network: {
          currentBlock,
          withdrawRewardPeriod: constants.withdrawRewardPeriod
        }
      });

    } catch (error) {
      return responseWrapper.error(error.message);
    }
  }, {
    params: t.Object({
      address: t.String()
    })
  })

  .get('/:address/performance', async ({ params }) => {
    try {
      const { address } = params;
      
      if (!validateAddress(address)) {
        return responseWrapper.error('Invalid validator address');
      }

      const [info, isJailed, isActivated, currentBlock] = await Promise.all([
        validatorService.getValidatorInfo(address),
        validatorService.isValidatorJailed(address),
        validatorService.isValidatorActivated(address),
        BlockchainService.getCurrentBlock()
      ]);

      // Calculate performance metrics (simplified)
      const performance = {
        isActive: !isJailed && isActivated,
        stakingAmount: info.stakingAmount,
        rewardAmount: info.rewardAmount,
        slashAmount: info.slashAmount,
        commissionRate: info.commissionRate,
        totalStakers: info.stakers ? info.stakers.length : 0,
        
        // Simplified metrics - would need historical data for accuracy
        uptime: isJailed ? '0%' : '100%',
        missedBlocks: 0,
        performanceScore: isJailed ? 0 : 100,
        
        // Network position
        rank: 0, // Would need to calculate based on all validators
        
        // Status flags
        isJailed,
        isActivated,
        lastActive: currentBlock
      };

      return responseWrapper.success({
        validator: address,
        performance,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      return responseWrapper.error(error.message);
    }
  }, {
    params: t.Object({
      address: t.String()
    })
  })

  // Get validator stakers
  .get('/:address/stakers', async ({ params, query }) => {
    try {
      const { address } = params;
      const page = parseInt(query.page) || 1;
      const limit = Math.min(parseInt(query.limit) || 20, 50);
      
      if (!validateAddress(address)) {
        return responseWrapper.error('Invalid validator address');
      }

      const validatorInfo = await validatorService.getValidatorInfo(address);
      const stakers = validatorInfo.stakers || [];
      
      // Paginate stakers
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedStakers = stakers.slice(startIndex, endIndex);

      return responseWrapper.success({
        validator: address,
        stakers: paginatedStakers,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(stakers.length / limit),
          totalItems: stakers.length,
          itemsPerPage: limit
        }
      });

    } catch (error) {
      return responseWrapper.error(error.message);
    }
  }, {
    params: t.Object({
      address: t.String()
    }),
    query: t.Object({
      page: t.Optional(t.Numeric()),
      limit: t.Optional(t.Numeric())
    })
  })

  // Get validator commission history (placeholder)
  .get('/:address/commission-history', async ({ params, query }) => {
    try {
      const { address } = params;
      const days = parseInt(query.days) || 30;
      
      if (!validateAddress(address)) {
        return responseWrapper.error('Invalid validator address');
      }

      // This would require historical data tracking
      // For now, return current commission rate
      const validatorInfo = await validatorService.getValidatorInfo(address);
      
      return responseWrapper.success({
        validator: address,
        currentCommission: validatorInfo.commissionRate,
        history: [], // Would be populated with historical commission changes
        period: `${days} days`,
        message: 'Historical commission data not yet available'
      });

    } catch (error) {
      return responseWrapper.error(error.message);
    }
  }, {
    params: t.Object({
      address: t.String()
    }),
    query: t.Object({
      days: t.Optional(t.Numeric())
    })
  })

  // Get validator rewards distribution
  .get('/:address/rewards', async ({ params, query }) => {
    try {
      const { address } = params;
      
      if (!validateAddress(address)) {
        return responseWrapper.error('Invalid validator address');
      }

      const validatorInfo = await validatorService.getValidatorInfo(address);
      const constants = await validatorService.getContractConstants();
      const currentBlock = await BlockchainService.getCurrentBlock();
      
      // Calculate reward information
      const canWithdraw = validatorInfo.lastWithdrawRewardBlock ? 
        (currentBlock - validatorInfo.lastWithdrawRewardBlock) >= constants.withdrawRewardPeriod : 
        true;
        
      const nextWithdrawBlock = validatorInfo.lastWithdrawRewardBlock ? 
        validatorInfo.lastWithdrawRewardBlock + constants.withdrawRewardPeriod : 
        currentBlock;

      return responseWrapper.success({
        validator: address,
        rewards: {
          totalRewards: validatorInfo.rewardAmount,
          canWithdraw,
          nextWithdrawBlock,
          blocksUntilWithdraw: Math.max(0, nextWithdrawBlock - currentBlock),
          lastWithdrawBlock: validatorInfo.lastWithdrawRewardBlock || 0
        },
        commission: {
          rate: validatorInfo.commissionRate,
          estimatedEarnings: (parseFloat(validatorInfo.rewardAmount) * parseFloat(validatorInfo.commissionRate)).toFixed(6)
        },
        network: {
          currentBlock,
          withdrawRewardPeriod: constants.withdrawRewardPeriod
        }
      });

    } catch (error) {
      return responseWrapper.error(error.message);
    }
  }, {
    params: t.Object({
      address: t.String()
    })
  });
