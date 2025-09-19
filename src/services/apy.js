import { BlockchainService } from "./blockchain.js";
import { CacheService } from "./cache.js";
import { Logger } from "../utils/logger.js";

export class APYCalculatorService {
  constructor() {
    this.cache = new CacheService('apy');
    this.logger = new Logger('APY Calculator');
    
    // Network constants untuk 1 second block time
    this.networkConstants = {
      BLOCKS_PER_DAY: 86400,      // 1s block time: 86400 seconds per day
      BLOCKS_PER_YEAR: 31536000,  // 365.25 * 86400
      SECONDS_PER_BLOCK: 1,       // 1 second block time
      REWARD_DISTRIBUTION_INTERVAL: 200 // blocks
    };
  }

  /**
   * Calculate APR (Annual Percentage Rate) - Simple interest
   */
  calculateAPR(dailyRewards, totalStaked) {
    if (totalStaked <= 0) return 0;
    
    const dailyRate = dailyRewards / totalStaked;
    const annualRate = dailyRate * 365;
    return annualRate * 100; // Convert to percentage
  }

  /**
   * Calculate APY (Annual Percentage Yield) - Compound interest
   * Assumes daily compounding
   */
  calculateAPY(dailyRewards, totalStaked, compoundingFrequency = 365) {
    if (totalStaked <= 0) return 0;
    
    const dailyRate = dailyRewards / totalStaked;
    const periodicRate = dailyRate / (compoundingFrequency / 365);
    
    // APY = (1 + r/n)^n - 1, where r = annual rate, n = compounding frequency
    const apy = Math.pow(1 + periodicRate, compoundingFrequency) - 1;
    return apy * 100; // Convert to percentage
  }

  /**
   * Estimate validator's daily rewards based on historical data
   */
  async estimateValidatorDailyRewards(validatorAddress, stakingAmount, commissionRate) {
    try {
      // Get network total staking
      const contract = BlockchainService.getContract();
      const totalNetworkStaking = await contract.totalStaking();
      const totalNetworkStakingEth = parseFloat(BlockchainService.formatEther(totalNetworkStaking));
      
      // Estimated daily network rewards (disesuaikan dengan 1s block time)
      const estimatedDailyNetworkRewards = this.estimateDailyNetworkRewards(totalNetworkStakingEth);
      
      // Validator's share of total staking
      const validatorShare = stakingAmount / totalNetworkStakingEth;
      
      // Validator's daily rewards before commission
      const validatorDailyRewards = estimatedDailyNetworkRewards * validatorShare;
      
      // Commission that goes to validator operator
      const validatorCommission = validatorDailyRewards * commissionRate;
      
      // Rewards distributed to delegators
      const delegatorRewards = validatorDailyRewards - validatorCommission;
      
      return {
        totalDailyRewards: validatorDailyRewards,
        validatorCommission: validatorCommission,
        delegatorRewards: delegatorRewards,
        networkShare: validatorShare
      };
      
    } catch (error) {
      this.logger.error('Error estimating validator daily rewards:', error);
      return {
        totalDailyRewards: 0,
        validatorCommission: 0,
        delegatorRewards: 0,
        networkShare: 0
      };
    }
  }

  /**
   * Estimate daily network rewards based on total staking
   * Updated untuk 1 second block time
   */
  estimateDailyNetworkRewards(totalStaking) {
    // Dengan 1s block time, ada 86400 blocks per hari
    // Assuming 5% annual inflation distributed to validators
    const annualInflationRate = parseFloat(process.env.NETWORK_INFLATION_RATE) || 0.05;
    const dailyInflationRate = annualInflationRate / 365;
    
    // If total supply is unknown, estimate based on staking
    // Assuming staking represents 60% of total supply
    const estimatedTotalSupply = totalStaking / 0.6;
    
    return estimatedTotalSupply * dailyInflationRate;
  }

  /**
   * Calculate comprehensive APY/APR metrics for a validator
   */
  async calculateValidatorYield(validatorAddress, validatorInfo, description) {
    const cacheKey = `validator_yield_${validatorAddress}`;
    
    try {
      // Check cache first (cache for 1 hour)
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;

      const stakingAmount = parseFloat(validatorInfo.stakingAmount);
      const commissionRate = parseFloat(validatorInfo.commissionRate);
      
      if (stakingAmount <= 0) {
        return this.getZeroYieldMetrics();
      }

      // Estimate daily rewards
      const rewardsEstimate = await this.estimateValidatorDailyRewards(
        validatorAddress, 
        stakingAmount, 
        commissionRate
      );

      // Calculate APR and APY for delegators
      const delegatorAPR = this.calculateAPR(rewardsEstimate.delegatorRewards, stakingAmount);
      const delegatorAPY = this.calculateAPY(rewardsEstimate.delegatorRewards, stakingAmount);

      // Calculate APR and APY for validator operator
      const validatorAPR = this.calculateAPR(rewardsEstimate.validatorCommission, stakingAmount);
      const validatorAPY = this.calculateAPY(rewardsEstimate.validatorCommission, stakingAmount);

      // Performance scoring
      const performanceScore = this.calculatePerformanceScore(
        delegatorAPY, 
        commissionRate, 
        stakingAmount,
        validatorInfo
      );

      // Risk assessment
      const riskMetrics = this.assessValidatorRisk(validatorInfo, stakingAmount);

      const result = {
        validatorAddress,
        moniker: description.moniker || 'Unknown',
        
        // Staking info
        totalStaked: stakingAmount.toFixed(6),
        commissionRate: (commissionRate * 100).toFixed(2) + '%',
        
        // Delegator yields
        delegator: {
          apr: delegatorAPR.toFixed(2) + '%',
          apy: delegatorAPY.toFixed(2) + '%',
          dailyRewards: rewardsEstimate.delegatorRewards.toFixed(6),
          monthlyRewards: (rewardsEstimate.delegatorRewards * 30).toFixed(6),
          yearlyRewards: (rewardsEstimate.delegatorRewards * 365).toFixed(6)
        },
        
        // Validator operator yields
        validator: {
          apr: validatorAPR.toFixed(2) + '%',
          apy: validatorAPY.toFixed(2) + '%',
          dailyCommission: rewardsEstimate.validatorCommission.toFixed(6),
          monthlyCommission: (rewardsEstimate.validatorCommission * 30).toFixed(6),
          yearlyCommission: (rewardsEstimate.validatorCommission * 365).toFixed(6)
        },
        
        // Performance metrics
        performance: {
          score: performanceScore.toFixed(1),
          ranking: this.getPerformanceRanking(performanceScore),
          networkShare: (rewardsEstimate.networkShare * 100).toFixed(4) + '%'
        },
        
        // Risk assessment
        risk: riskMetrics,
        
        // Additional metrics
        metrics: {
          expectedDailyYield: rewardsEstimate.totalDailyRewards.toFixed(6),
          breakEvenTime: this.calculateBreakEvenTime(delegatorAPY),
          compoundingEffect: ((delegatorAPY - delegatorAPR) / delegatorAPR * 100).toFixed(2) + '%',
          totalStakers: validatorInfo.stakers ? validatorInfo.stakers.length : 0,
          averageStakePerDelegator: validatorInfo.stakers && validatorInfo.stakers.length > 0 ? 
            (stakingAmount / validatorInfo.stakers.length).toFixed(6) : '0'
        },
        
        // Calculation metadata (updated for 1s blocks)
        meta: {
          calculatedAt: new Date().toISOString(),
          basedOnCurrentStaking: stakingAmount.toFixed(6),
          assumedBlockTime: this.networkConstants.SECONDS_PER_BLOCK + 's',
          blocksPerDay: this.networkConstants.BLOCKS_PER_DAY,
          compoundingFrequency: 'Daily',
          disclaimer: 'Estimates based on current network conditions with 1s block time'
        }
      };

      // Cache for 1 hour
      this.cache.set(cacheKey, result, 3600000);
      return result;

    } catch (error) {
      this.logger.error(`Error calculating yield for validator ${validatorAddress}:`, error);
      return this.getZeroYieldMetrics(validatorAddress, description);
    }
  }

  /**
   * Calculate performance score (0-100)
   */
  calculatePerformanceScore(apy, commissionRate, stakingAmount, validatorInfo) {
    let score = 50; // Base score
    
    // APY contribution (0-40 points)
    if (apy > 15) score += 40;
    else if (apy > 12) score += 30;
    else if (apy > 10) score += 20;
    else if (apy > 8) score += 10;
    
    // Commission rate contribution (0-25 points)
    if (commissionRate < 0.05) score += 25;
    else if (commissionRate < 0.10) score += 20;
    else if (commissionRate < 0.15) score += 15;
    else if (commissionRate < 0.20) score += 10;
    else score -= 10;
    
    // Staking amount contribution (0-20 points)
    if (stakingAmount > 100000) score += 20;
    else if (stakingAmount > 50000) score += 15;
    else if (stakingAmount > 10000) score += 10;
    else if (stakingAmount > 1000) score += 5;
    
    // Validator status (0-15 points)
    if (validatorInfo.status === 1) score += 15; // Active
    if (parseFloat(validatorInfo.slashAmount) === 0) score += 5; // Never slashed
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Assess validator risk
   */
  assessValidatorRisk(validatorInfo, stakingAmount) {
    const slashAmount = parseFloat(validatorInfo.slashAmount);
    const totalStakers = validatorInfo.stakers ? validatorInfo.stakers.length : 0;
    
    let riskLevel = 'LOW';
    let riskFactors = [];
    let riskScore = 0;
    
    // Slash history
    if (slashAmount > 0) {
      riskFactors.push('Has been slashed previously');
      riskScore += 30;
    }
    
    // Staking concentration
    if (totalStakers < 10) {
      riskFactors.push('Low number of delegators');
      riskScore += 20;
    }
    
    // Total stake amount
    if (stakingAmount < 1000) {
      riskFactors.push('Low total staking amount');
      riskScore += 25;
    }
    
    // Commission rate
    const commissionRate = parseFloat(validatorInfo.commissionRate);
    if (commissionRate > 0.20) {
      riskFactors.push('High commission rate');
      riskScore += 15;
    }
    
    // Determine risk level
    if (riskScore >= 50) riskLevel = 'HIGH';
    else if (riskScore >= 25) riskLevel = 'MEDIUM';
    
    return {
      level: riskLevel,
      score: riskScore,
      factors: riskFactors,
      recommendation: this.getRiskRecommendation(riskLevel, riskScore)
    };
  }

  /**
   * Get performance ranking
   */
  getPerformanceRanking(score) {
    if (score >= 85) return 'EXCELLENT';
    if (score >= 70) return 'GOOD';
    if (score >= 55) return 'AVERAGE';
    if (score >= 40) return 'BELOW_AVERAGE';
    return 'POOR';
  }

  /**
   * Get risk recommendation
   */
  getRiskRecommendation(riskLevel, riskScore) {
    switch (riskLevel) {
      case 'LOW':
        return 'Suitable for conservative investors seeking steady returns';
      case 'MEDIUM':
        return 'Moderate risk - suitable for balanced portfolios';
      case 'HIGH':
        return 'High risk - only for experienced investors who understand the risks';
      default:
        return 'Unknown risk level';
    }
  }

  /**
   * Calculate break-even time in days
   */
  calculateBreakEvenTime(apy) {
    if (apy <= 0) return 'N/A';
    
    // Simple break-even calculation based on when rewards equal initial investment
    const dailyRate = apy / 365 / 100;
    const breakEvenDays = Math.ceil(1 / dailyRate);
    
    if (breakEvenDays > 3650) return '10+ years';
    if (breakEvenDays > 365) return `${Math.ceil(breakEvenDays / 365)} years`;
    if (breakEvenDays > 30) return `${Math.ceil(breakEvenDays / 30)} months`;
    
    return `${breakEvenDays} days`;
  }

  /**
   * Get zero yield metrics for error cases
   */
  getZeroYieldMetrics(validatorAddress = 'unknown', description = {}) {
    return {
      validatorAddress,
      moniker: description.moniker || 'Unknown',
      totalStaked: '0',
      commissionRate: '0%',
      delegator: {
        apr: '0%',
        apy: '0%',
        dailyRewards: '0',
        monthlyRewards: '0',
        yearlyRewards: '0'
      },
      validator: {
        apr: '0%',
        apy: '0%',
        dailyCommission: '0',
        monthlyCommission: '0',
        yearlyCommission: '0'
      },
      performance: {
        score: '0',
        ranking: 'UNKNOWN',
        networkShare: '0%'
      },
      risk: {
        level: 'UNKNOWN',
        score: 0,
        factors: ['Insufficient data'],
        recommendation: 'Cannot assess due to lack of data'
      },
      metrics: {
        expectedDailyYield: '0',
        breakEvenTime: 'N/A',
        compoundingEffect: '0%',
        totalStakers: 0,
        averageStakePerDelegator: '0'
      },
      meta: {
        calculatedAt: new Date().toISOString(),
        assumedBlockTime: '1s',
        blocksPerDay: 86400,
        error: 'Unable to calculate yields',
        disclaimer: 'No data available for yield calculation'
      }
    };
  }

  /**
   * Compare multiple validators
   */
  async compareValidators(validatorList) {
    try {
      const comparisons = await Promise.all(
        validatorList.map(async ({ address, info, description }) => {
          return await this.calculateValidatorYield(address, info, description);
        })
      );

      // Sort by performance score
      comparisons.sort((a, b) => 
        parseFloat(b.performance.score) - parseFloat(a.performance.score)
      );

      return {
        comparisons,
        summary: {
          totalValidators: comparisons.length,
          averageAPY: this.calculateAverageAPY(comparisons),
          bestPerformer: comparisons[0]?.validatorAddress || null,
          lowestRisk: this.findLowestRiskValidator(comparisons),
          highestAPY: this.findHighestAPYValidator(comparisons)
        },
        recommendations: this.generateRecommendations(comparisons),
        networkInfo: {
          blockTime: '1 second',
          blocksPerDay: this.networkConstants.BLOCKS_PER_DAY,
          assumedInflationRate: (parseFloat(process.env.NETWORK_INFLATION_RATE) || 0.05) * 100 + '%'
        }
      };

    } catch (error) {
      this.logger.error('Error comparing validators:', error);
      throw error;
    }
  }

  calculateAverageAPY(comparisons) {
    if (comparisons.length === 0) return '0%';
    
    const total = comparisons.reduce((sum, comp) => {
      return sum + parseFloat(comp.delegator.apy.replace('%', ''));
    }, 0);
    
    return (total / comparisons.length).toFixed(2) + '%';
  }

  findLowestRiskValidator(comparisons) {
    return comparisons.reduce((lowest, current) => {
      if (!lowest || current.risk.score < lowest.risk.score) {
        return current;
      }
      return lowest;
    }, null)?.validatorAddress || null;
  }

  findHighestAPYValidator(comparisons) {
    return comparisons.reduce((highest, current) => {
      const currentAPY = parseFloat(current.delegator.apy.replace('%', ''));
      const highestAPY = highest ? parseFloat(highest.delegator.apy.replace('%', '')) : 0;
      
      if (currentAPY > highestAPY) {
        return current;
      }
      return highest;
    }, null)?.validatorAddress || null;
  }

  generateRecommendations(comparisons) {
    const recommendations = [];

    // Conservative investor
    const lowRisk = comparisons.filter(c => c.risk.level === 'LOW');
    if (lowRisk.length > 0) {
      const best = lowRisk.sort((a, b) => 
        parseFloat(b.delegator.apy.replace('%', '')) - parseFloat(a.delegator.apy.replace('%', ''))
      )[0];
      
      recommendations.push({
        type: 'CONSERVATIVE',
        validator: best.validatorAddress,
        moniker: best.moniker,
        reason: `Lowest risk with ${best.delegator.apy} APY`,
        riskLevel: best.risk.level
      });
    }

    // Growth investor
    const highAPY = comparisons.filter(c => 
      parseFloat(c.delegator.apy.replace('%', '')) > 10 && c.risk.level !== 'HIGH'
    );
    if (highAPY.length > 0) {
      const best = highAPY[0];
      recommendations.push({
        type: 'GROWTH',
        validator: best.validatorAddress,
        moniker: best.moniker,
        reason: `High yield ${best.delegator.apy} with moderate risk`,
        riskLevel: best.risk.level
      });
    }

    // Balanced portfolio
    if (comparisons.length >= 3) {
      recommendations.push({
        type: 'DIVERSIFIED',
        validators: comparisons.slice(0, 3).map(c => ({
          address: c.validatorAddress,
          moniker: c.moniker,
          apy: c.delegator.apy,
          weight: '33.33%'
        })),
        reason: 'Diversify across top 3 performers to reduce risk'
      });
    }

    return recommendations;
  }

  /**
   * Clear all APY cache
   */
  clearCache() {
    this.cache.clear();
    this.logger.info('APY cache cleared');
  }
}