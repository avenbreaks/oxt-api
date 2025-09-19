import { Elysia, t } from "elysia";
import { ValidatorService } from "../services/validator.js";
import { DelegatorService } from "../services/delegator.js";
import { BlockchainService } from "../services/blockchain.js";
import { cacheManager } from "../services/cache.js";
import { responseWrapper } from "../utils/response.js";

const validatorService = new ValidatorService();
const delegatorService = new DelegatorService();

export const statsRoutes = new Elysia({ prefix: '/api' })

  // Basic network statistics
  .get('/stats', async () => {
    try {
      const [
        totalStaking,
        validators,
        candidates,
        currentBlock
      ] = await Promise.all([
        validatorService.getTotalStaking(),
        validatorService.getActivatedValidators(),
        validatorService.getValidatorCandidates(),
        BlockchainService.getCurrentBlock()
      ]);

      // Get validator details for additional metrics
      const validatorDetails = await Promise.all(
        validators.slice(0, 10).map(async (address) => {
          const info = await validatorService.getValidatorInfo(address);
          return {
            address,
            stakingAmount: parseFloat(info.stakingAmount),
            stakers: info.stakers ? info.stakers.length : 0
          };
        })
      );

      const totalDelegators = validatorDetails.reduce((sum, v) => sum + v.stakers, 0);
      const avgStakingPerValidator = validators.length > 0 ? 
        parseFloat(totalStaking) / validators.length : 0;

      // Get top validators by staking amount
      const topValidators = validatorDetails
        .sort((a, b) => b.stakingAmount - a.stakingAmount)
        .slice(0, 5)
        .map(v => ({
          address: v.address,
          stakingAmount: v.stakingAmount.toFixed(6),
          stakers: v.stakers
        }));

      return responseWrapper.success({
        network: {
          totalStaking,
          totalValidators: validators.length,
          totalCandidates: candidates.totalCount,
          totalDelegators,
          currentBlock,
          avgStakingPerValidator: avgStakingPerValidator.toFixed(6)
        },
        topValidators
      });

    } catch (error) {
      return responseWrapper.error(error.message);
    }
  })

  // Detailed network statistics
  .get('/network/stats', async () => {
    try {
      const [
        totalStaking,
        activatedValidators,
        candidates,
        constants,
        networkInfo,
        delegatorStats
      ] = await Promise.all([
        validatorService.getTotalStaking(),
        validatorService.getActivatedValidators(),
        validatorService.getValidatorCandidates(),
        validatorService.getContractConstants(),
        BlockchainService.getNetworkInfo(),
        delegatorService.getDelegatorStatistics()
      ]);

      // Calculate network health metrics
      const networkUtilization = (activatedValidators.length / constants.maxValidatorNum) * 100;
      const stakingRatio = parseFloat(totalStaking) / 1000000; // Assuming total supply

      // Get additional validator metrics
      const validatorMetrics = await Promise.all(
        activatedValidators.slice(0, 20).map(async (address) => {
          const [info, isJailed] = await Promise.all([
            validatorService.getValidatorInfo(address),
            validatorService.isValidatorJailed(address)
          ]);
          
          return {
            stakingAmount: parseFloat(info.stakingAmount),
            isJailed,
            stakers: info.stakers ? info.stakers.length : 0
          };
        })
      );

      const jailedCount = validatorMetrics.filter(v => v.isJailed).length;
      const activeCount = validatorMetrics.filter(v => !v.isJailed).length;
      
      // Calculate distribution metrics
      const stakingAmounts = validatorMetrics.map(v => v.stakingAmount).sort((a, b) => b - a);
      const medianStaking = stakingAmounts.length > 0 ? 
        stakingAmounts[Math.floor(stakingAmounts.length / 2)] : 0;
      
      const totalValidatorStaking = stakingAmounts.reduce((sum, amount) => sum + amount, 0);
      const giniCoefficient = calculateGini(stakingAmounts); // Measure of inequality

      return responseWrapper.success({
        overview: {
          totalStaking,
          activeValidators: activatedValidators.length,
          jailedValidators: jailedCount,
          totalCandidates: candidates.totalCount,
          maxValidators: constants.maxValidatorNum,
          networkUtilization: networkUtilization.toFixed(2) + '%',
          stakingRatio: stakingRatio.toFixed(4)
        },
        blockchain: {
          ...networkInfo,
          blockEpoch: constants.blockEpoch
        },
        staking: {
          totalAmount: totalStaking,
          medianValidatorStaking: medianStaking.toFixed(6),
          minimalStaking: constants.minimalStaking,
          validatorSlashAmount: constants.validatorSlashAmount,
          stakingConcentration: giniCoefficient.toFixed(4)
        },
        delegators: delegatorStats,
        parameters: {
          stakingLockPeriod: constants.stakingLockPeriod,
          withdrawRewardPeriod: constants.withdrawRewardPeriod,
          defaultCommissionRate: constants.defaultCommissionRate,
          maxCommissionRate: constants.maxCommissionRate
        },
        health: {
          networkUtilization: networkUtilization.toFixed(2) + '%',
          validatorHealth: ((activeCount / (activeCount + jailedCount)) * 100).toFixed(2) + '%',
          stakingDistribution: giniCoefficient < 0.5 ? 'Healthy' : 'Concentrated'
        }
      });

    } catch (error) {
      return responseWrapper.error(error.message);
    }
  })

  // Get configuration and constants
  .get('/config', async () => {
    try {
      const [constants, networkInfo] = await Promise.all([
        validatorService.getContractConstants(),
        BlockchainService.getNetworkInfo()
      ]);

      return responseWrapper.success({
        contract: {
          ...constants,
          address: BlockchainService.getContract().target
        },
        network: networkInfo,
        api: {
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          features: [
            'validators',
            'delegators',
            'staking',
            'websocket',
            'search',
            'statistics'
          ]
        }
      });

    } catch (error) {
      return responseWrapper.error(error.message);
    }
  })

  // Get API statistics
  .get('/api-stats', async () => {
    try {
      const cacheStats = cacheManager.getAllStats();
      
      return responseWrapper.success({
        cache: cacheStats,
        uptime: process.uptime(),
        memory: {
          used: process.memoryUsage().heapUsed / 1024 / 1024, // MB
          total: process.memoryUsage().heapTotal / 1024 / 1024, // MB
          external: process.memoryUsage().external / 1024 / 1024 // MB
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      return responseWrapper.error(error.message);
    }
  })

  // Get validator distribution
  .get('/validators/distribution', async ({ query }) => {
    try {
      const type = query.type || 'staking'; // 'staking', 'commission', 'delegators'
      
      const validators = await validatorService.getActivatedValidators();
      const validatorData = await Promise.all(
        validators.map(async (address) => {
          const info = await validatorService.getValidatorInfo(address);
          const description = await validatorService.getValidatorDescription(address);
          
          return {
            address,
            moniker: description.moniker,
            stakingAmount: parseFloat(info.stakingAmount),
            commissionRate: parseFloat(info.commissionRate),
            delegatorCount: info.stakers ? info.stakers.length : 0
          };
        })
      );

      let distribution = [];
      
      switch (type) {
        case 'staking':
          distribution = createDistributionBuckets(
            validatorData.map(v => v.stakingAmount),
            'Staking Amount'
          );
          break;
          
        case 'commission':
          distribution = createDistributionBuckets(
            validatorData.map(v => v.commissionRate * 100), // Convert to percentage
            'Commission Rate (%)'
          );
          break;
          
        case 'delegators':
          distribution = createDistributionBuckets(
            validatorData.map(v => v.delegatorCount),
            'Delegator Count'
          );
          break;
          
        default:
          throw new Error('Invalid distribution type');
      }

      return responseWrapper.success({
        type,
        distribution,
        totalValidators: validators.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      return responseWrapper.error(error.message);
    }
  }, {
    query: t.Object({
      type: t.Optional(t.Union([
        t.Literal('staking'),
        t.Literal('commission'),
        t.Literal('delegators')
      ]))
    })
  })

  // Get historical statistics (placeholder)
  .get('/stats/historical', async ({ query }) => {
    try {
      const days = Math.min(parseInt(query.days) || 30, 365);
      const interval = query.interval || 'daily'; // 'hourly', 'daily', 'weekly'
      
      // This would require historical data storage
      // For now, return current stats with placeholder historical data
      const currentStats = await validatorService.getTotalStaking();
      
      return responseWrapper.success({
        period: `${days} days`,
        interval,
        data: [], // Would contain historical data points
        current: {
          totalStaking: currentStats,
          timestamp: new Date().toISOString()
        },
        message: 'Historical data collection not yet implemented'
      });

    } catch (error) {
      return responseWrapper.error(error.message);
    }
  }, {
    query: t.Object({
      days: t.Optional(t.Numeric()),
      interval: t.Optional(t.Union([
        t.Literal('hourly'),
        t.Literal('daily'),
        t.Literal('weekly')
      ]))
    })
  });

// Utility functions
function calculateGini(values) {
  if (values.length === 0) return 0;
  
  const sorted = values.slice().sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  
  if (sum === 0) return 0;
  
  let gini = 0;
  for (let i = 0; i < n; i++) {
    gini += (2 * (i + 1) - n - 1) * sorted[i];
  }
  
  return gini / (n * sum);
}

function createDistributionBuckets(values, label) {
  if (values.length === 0) return [];
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  const bucketCount = Math.min(10, values.length); // Max 10 buckets
  const bucketSize = (max - min) / bucketCount;
  
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    min: min + i * bucketSize,
    max: min + (i + 1) * bucketSize,
    count: 0,
    percentage: 0
  }));
  
  // Fill buckets
  values.forEach(value => {
    const bucketIndex = Math.min(
      Math.floor((value - min) / bucketSize),
      bucketCount - 1
    );
    buckets[bucketIndex].count++;
  });
  
  // Calculate percentages
  buckets.forEach(bucket => {
    bucket.percentage = ((bucket.count / values.length) * 100).toFixed(2);
  });
  
  return {
    label,
    buckets: buckets.filter(bucket => bucket.count > 0),
    stats: {
      min,
      max,
      average: (values.reduce((sum, val) => sum + val, 0) / values.length).toFixed(6),
      median: values.sort((a, b) => a - b)[Math.floor(values.length / 2)].toFixed(6)
    }
  };
}