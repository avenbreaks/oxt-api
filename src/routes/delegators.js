import { Elysia, t } from "elysia";
import { DelegatorService } from "../services/delegator.js";
import { BlockchainService } from "../services/blockchain.js";
import { responseWrapper } from "../utils/response.js";
import { validateAddress } from "../utils/validation.js";

const delegatorService = new DelegatorService();

export const delegatorRoutes = new Elysia({ prefix: '/api/delegator' })
  
  // Get delegator information
  .get('/:address', async ({ params, query }) => {
    try {
      const { address } = params;
      const includeInactive = query.includeInactive === 'true';
      const includeHistory = query.includeHistory === 'true';
      
      if (!validateAddress(address)) {
        return responseWrapper.error('Invalid delegator address');
      }

      const delegatorInfo = await delegatorService.getDelegatorInfo(address, {
        includeInactive,
        includeHistory
      });

      return responseWrapper.success(delegatorInfo);

    } catch (error) {
      return responseWrapper.error(error.message);
    }
  }, {
    params: t.Object({
      address: t.String()
    }),
    query: t.Object({
      includeInactive: t.Optional(t.String()),
      includeHistory: t.Optional(t.String())
    })
  })

  // Get delegator history
  .get('/:address/history', async ({ params, query }) => {
    try {
      const { address } = params;
      const options = {
        limit: Math.min(parseInt(query.limit) || 50, 100),
        includeEvents: query.includeEvents === 'true'
      };
      
      if (!validateAddress(address)) {
        return responseWrapper.error('Invalid delegator address');
      }

      const history = await delegatorService.getDelegatorHistory(address, options);

      return responseWrapper.success(history);

    } catch (error) {
      return responseWrapper.error(error.message);
    }
  }, {
    params: t.Object({
      address: t.String()
    }),
    query: t.Object({
      limit: t.Optional(t.Numeric()),
      includeEvents: t.Optional(t.String())
    })
  })

  // Get delegator rewards summary
  .get('/:address/rewards', async ({ params }) => {
    try {
      const { address } = params;
      
      if (!validateAddress(address)) {
        return responseWrapper.error('Invalid delegator address');
      }

      const delegatorInfo = await delegatorService.getDelegatorInfo(address);
      
      // Calculate rewards breakdown
      const rewardsBreakdown = delegatorInfo.delegations.map(delegation => ({
        validator: delegation.validatorAddress,
        validatorMoniker: delegation.validatorMoniker,
        stakedAmount: delegation.stakedAmount,
        pendingRewards: delegation.pendingRewards,
        commission: delegation.validatorCommission,
        netRewards: (
          parseFloat(delegation.pendingRewards) * 
          (1 - parseFloat(delegation.validatorCommission))
        ).toFixed(6)
      }));

      const totalNetRewards = rewardsBreakdown.reduce((sum, reward) => 
        sum + parseFloat(reward.netRewards), 0
      );

      return responseWrapper.success({
        delegatorAddress: address,
        totalPendingRewards: delegatorInfo.summary.totalPendingRewards,
        totalNetRewards: totalNetRewards.toFixed(6),
        rewardsBreakdown,
        averageCommission: delegatorInfo.summary.averageCommission,
        lastUpdated: new Date().toISOString()
      });

    } catch (error) {
      return responseWrapper.error(error.message);
    }
  }, {
    params: t.Object({
      address: t.String()
    })
  });

// Staking-specific routes
export const stakingRoutes = new Elysia({ prefix: '/api/staking' })
  
  // Get staking details for specific delegator-validator pair
  .get('/:delegator/:validator', async ({ params }) => {
    try {
      const { delegator, validator } = params;
      
      if (!validateAddress(delegator)) {
        return responseWrapper.error('Invalid delegator address');
      }
      
      if (!validateAddress(validator)) {
        return responseWrapper.error('Invalid validator address');
      }

      const stakingDetails = await delegatorService.getStakingDetails(delegator, validator);

      return responseWrapper.success(stakingDetails);

    } catch (error) {
      return responseWrapper.error(error.message);
    }
  }, {
    params: t.Object({
      delegator: t.String(),
      validator: t.String()
    })
  })

  // Get withdrawal status
  .get('/:delegator/:validator/withdrawal-status', async ({ params }) => {
    try {
      const { delegator, validator } = params;
      
      if (!validateAddress(delegator)) {
        return responseWrapper.error('Invalid delegator address');
      }
      
      if (!validateAddress(validator)) {
        return responseWrapper.error('Invalid validator address');
      }

      const withdrawalStatus = await delegatorService.getWithdrawalStatus(delegator, validator);

      return responseWrapper.success({
        delegator,
        validator,
        withdrawal: withdrawalStatus,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      return responseWrapper.error(error.message);
    }
  }, {
    params: t.Object({
      delegator: t.String(),
      validator: t.String()
    })
  })

  // Get staking rewards for specific pair
  .get('/:delegator/:validator/rewards', async ({ params }) => {
    try {
      const { delegator, validator } = params;
      
      if (!validateAddress(delegator)) {
        return responseWrapper.error('Invalid delegator address');
      }
      
      if (!validateAddress(validator)) {
        return responseWrapper.error('Invalid validator address');
      }

      const [
        rewardInfo,
        pendingRewards,
        validatorInfo
      ] = await Promise.all([
        delegatorService.getDelegatorRewardInfo(delegator, validator),
        delegatorService.getPendingRewards(delegator, validator),
        delegatorService.validatorService.getValidatorInfo(validator)
      ]);

      const commission = parseFloat(validatorInfo.commissionRate);
      const grossRewards = parseFloat(pendingRewards);
      const netRewards = grossRewards * (1 - commission);
      const commissionAmount = grossRewards * commission;

      return responseWrapper.success({
        delegator,
        validator,
        rewards: {
          ...rewardInfo,
          pendingRewards,
          grossRewards: grossRewards.toFixed(6),
          netRewards: netRewards.toFixed(6),
          commissionAmount: commissionAmount.toFixed(6),
          commissionRate: validatorInfo.commissionRate
        },
        canClaim: parseFloat(pendingRewards) > 0,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      return responseWrapper.error(error.message);
    }
  }, {
    params: t.Object({
      delegator: t.String(),
      validator: t.String()
    })
  });

// Combine delegator and staking routes
export const delegatorAndStakingRoutes = new Elysia()
  .use(delegatorRoutes)
  .use(stakingRoutes);