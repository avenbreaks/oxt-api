// ============================================================================
// APR CALCULATOR SERVICE FOR OXT STAKING
// ============================================================================
// Configuration:
// - Minimum stake: 1,000 OXT
// - Block time: 1 second (configurable to 5 seconds)
// - APR calculation based on validator rewards and total staking amount
// ============================================================================

import { ethers } from 'ethers';

class APRCalculatorService {
    constructor(provider, validatorContractAddress, validatorABI) {
        this.provider = provider;
        this.contract = new ethers.Contract(validatorContractAddress, validatorABI, provider);

        // ========================================
        // CONFIGURATION SECTION - EASY TO MODIFY
        // ========================================
        this.config = {
            // Minimum staking amount for delegators
            MIN_DELEGATOR_STAKE: ethers.parseEther('1000'), // 1,000 OXT

            // Block time configurations (in seconds)
            BLOCK_TIME_FAST: 1,    // 1 second - main configuration
            BLOCK_TIME_SLOW: 5,    // 5 seconds - alternative configuration

            // Time calculations
            SECONDS_PER_YEAR: 365 * 24 * 60 * 60, // 31,536,000 seconds
            BLOCKS_PER_YEAR_FAST: 31536000,       // blocks per year with 1s block time
            BLOCKS_PER_YEAR_SLOW: 6307200,        // blocks per year with 5s block time

            // Default commission rate if not available
            DEFAULT_COMMISSION_RATE: 500, // 5% in basis points (10000 = 100%)
        };
    }

    // ============================================================================
    // MAIN APR CALCULATION FUNCTIONS
    // ============================================================================

    /**
     * Calculate APR for a delegator staking to a specific validator
     * @param {string} delegatorAddress - Address of the delegator
     * @param {string} validatorAddress - Address of the validator
     * @param {number} blockTime - Block time in seconds (1 or 5)
     * @returns {Promise<Object>} APR calculation results
     */
    async calculateDelegatorAPR(delegatorAddress, validatorAddress, blockTime = 1, skipMinimumStakeCheck = false) {
        try {
            // Get validator information
            const validatorInfo = await this.contract.getValidatorInfo(validatorAddress);
            const [rewardAddr, status, stakingAmount, commissionRate, rewardAmount, slashAmount, stakers] = validatorInfo;

            // DEBUG: Log raw contract data
            console.log('Raw validator info from contract:', {
                validator: validatorAddress,
                rewardAddr: rewardAddr.toString(),
                status: status.toString(),
                stakingAmount: stakingAmount.toString(),
                commissionRate: commissionRate.toString(), // <- Yang penting
                rewardAmount: rewardAmount.toString(),
                slashAmount: slashAmount.toString(),
                stakersCount: stakers.length
            });

            // Get delegator's staking info
            const stakingInfo = await this.contract.getStakingInfo(delegatorAddress, validatorAddress);
            const [delegatorStake, unstakeBlock, index] = stakingInfo;

            // Check if delegator meets minimum stake requirement
            const effectiveStake = skipMinimumStakeCheck ? this.config.MIN_DELEGATOR_STAKE : delegatorStake;

            // Check if delegator meets minimum stake requirement (skip for theoretical calculation)
            if (!skipMinimumStakeCheck && delegatorStake < this.config.MIN_DELEGATOR_STAKE) {
                return {
                    success: false,
                    error: 'INSUFFICIENT_STAKE',
                    message: `Minimum stake required: ${ethers.formatEther(this.config.MIN_DELEGATOR_STAKE)} OXT`,
                    currentStake: ethers.formatEther(delegatorStake),
                    minStake: ethers.formatEther(this.config.MIN_DELEGATOR_STAKE)
                };
            }

            // Calculate APR based on block time
            const aprData = blockTime === 1
                ? this.calculateAPRFast(stakingAmount, rewardAmount, commissionRate, effectiveStake)
                : this.calculateAPRSlow(stakingAmount, rewardAmount, commissionRate, effectiveStake);

            return {
                success: true,
                data: {
                    delegator: delegatorAddress,
                    validator: validatorAddress,
                    blockTime: blockTime,
                    delegatorStake: ethers.formatEther(effectiveStake),
                    validatorTotalStake: ethers.formatEther(stakingAmount),
                    commissionRate: this.formatCommissionRate(commissionRate),
                    ...aprData,
                    calculatedAt: new Date().toISOString()
                }
            };

        } catch (error) {
            return {
                success: false,
                error: 'CALCULATION_ERROR',
                message: error.message
            };
        }
    }

    // ========================================
    // APR CALCULATION FOR 1 SECOND BLOCK TIME
    // ========================================
    calculateAPRFast(validatorStaking, validatorRewards, commissionRate, delegatorStake) {
        console.log('APR Calculation Debug:', {
            validatorStaking: validatorStaking.toString(),
            validatorRewards: validatorRewards.toString(),
            commissionRate: commissionRate.toString(),
            delegatorStake: delegatorStake.toString(),
            blocksPerYear: this.config.BLOCKS_PER_YEAR_FAST
        });

        // Fallback calculation for validators without reward history
        let effectiveRewards = validatorRewards;
        let calculationMethod = 'historical';

        if (validatorRewards === 0n) {
            // Estimasi berdasarkan 5% annual network inflation
            // Asumsi validator mendapat reward proporsional dengan stake mereka
            const NETWORK_INFLATION_RATE = 0.05; // 5% per tahun

            // Estimasi reward per block berdasarkan validator stake share
            // Asumsi simple: validator reward = (validator_stake * inflation_rate) / blocks_per_year
            const annualInflationReward = validatorStaking * BigInt(Math.floor(NETWORK_INFLATION_RATE * 10000)) / BigInt(10000);
            effectiveRewards = annualInflationReward / BigInt(this.config.BLOCKS_PER_YEAR_FAST);
            calculationMethod = 'estimated';

            console.log('Using fallback calculation (network inflation):', {
                networkInflationRate: NETWORK_INFLATION_RATE,
                annualInflationReward: annualInflationReward.toString(),
                effectiveRewardsPerBlock: effectiveRewards.toString()
            });
        }

        const totalStaking = validatorStaking;
        const delegatorShare = (delegatorStake * BigInt(10000)) / totalStaking;

        // Calculate annual rewards using effective rewards
        const estimatedAnnualRewards = effectiveRewards * BigInt(this.config.BLOCKS_PER_YEAR_FAST);

        console.log('APR Intermediate calculations:', {
            totalStaking: totalStaking.toString(),
            delegatorShare: delegatorShare.toString(),
            estimatedAnnualRewards: estimatedAnnualRewards.toString(),
            calculationMethod: calculationMethod
        });

        // Calculate delegator's share after commission
        let commission = Number(commissionRate || this.config.DEFAULT_COMMISSION_RATE);

        // Fix: if commission rate is corrupted (> 10000), use default instead
        if (commission > 10000) {
            console.warn('Commission rate exceeds 100%, using default:', {
                originalRate: commission,
                defaultRate: this.config.DEFAULT_COMMISSION_RATE
            });
            commission = this.config.DEFAULT_COMMISSION_RATE; // 500 = 5%
        }

        const delegatorRewardRate = BigInt(10000 - commission);

        const delegatorAnnualRewards = (estimatedAnnualRewards * delegatorShare * delegatorRewardRate)
            / (BigInt(10000) * BigInt(10000));

        // Calculate APR percentage
        const aprBasisPoints = delegatorStake > 0n ? (delegatorAnnualRewards * BigInt(10000)) / delegatorStake : 0n;
        const apr = Number(aprBasisPoints) / 100;

        console.log('APR Final calculations:', {
            commission: commission.toString(),
            delegatorRewardRate: delegatorRewardRate.toString(),
            delegatorAnnualRewards: delegatorAnnualRewards.toString(),
            aprBasisPoints: aprBasisPoints.toString(),
            finalAPR: apr,
            calculationMethod: calculationMethod
        });

        return {
            apr: apr.toFixed(2),
            aprPercent: `${apr.toFixed(2)}%`,
            estimatedAnnualRewards: ethers.formatEther(delegatorAnnualRewards),
            delegatorShare: (Number(delegatorShare) / 100).toFixed(2),
            blockConfiguration: '1 second per block',
            blocksPerYear: this.config.BLOCKS_PER_YEAR_FAST,
            calculationMethod: calculationMethod,
            note: calculationMethod === 'estimated' ? 'APR estimated based on 5% network inflation (validator has no reward history)' : undefined
        };
    }

    // ========================================
    // APR CALCULATION FOR 5 SECONDS BLOCK TIME
    // ========================================
    calculateAPRSlow(validatorStaking, validatorRewards, commissionRate, delegatorStake) {
        // Fallback calculation sama seperti calculateAPRFast
        let effectiveRewards = validatorRewards;
        let calculationMethod = 'historical';

        if (validatorRewards === 0n) {
            const NETWORK_INFLATION_RATE = 0.05; // 5% per tahun
            const annualInflationReward = validatorStaking * BigInt(Math.floor(NETWORK_INFLATION_RATE * 10000)) / BigInt(10000);
            effectiveRewards = annualInflationReward / BigInt(this.config.BLOCKS_PER_YEAR_SLOW);
            calculationMethod = 'estimated';
        }

        const totalStaking = validatorStaking;
        const delegatorShare = (delegatorStake * BigInt(10000)) / totalStaking;

        // Use effective rewards
        const estimatedAnnualRewards = effectiveRewards * BigInt(this.config.BLOCKS_PER_YEAR_SLOW);

        // Fix commission rate handling
        let commission = Number(commissionRate || this.config.DEFAULT_COMMISSION_RATE);
        if (commission > 10000) {
            commission = this.config.DEFAULT_COMMISSION_RATE;
        }
        const delegatorRewardRate = BigInt(10000 - commission);

        const delegatorAnnualRewards = (estimatedAnnualRewards * delegatorShare * delegatorRewardRate)
            / (BigInt(10000) * BigInt(10000));

        const aprBasisPoints = delegatorStake > 0n ? (delegatorAnnualRewards * BigInt(10000)) / delegatorStake : 0n;
        const apr = Number(aprBasisPoints) / 100;

        return {
            apr: apr.toFixed(2),
            aprPercent: `${apr.toFixed(2)}%`,
            estimatedAnnualRewards: ethers.formatEther(delegatorAnnualRewards),
            delegatorShare: (Number(delegatorShare) / 100).toFixed(2),
            blockConfiguration: '5 seconds per block',
            blocksPerYear: this.config.BLOCKS_PER_YEAR_SLOW,
            calculationMethod: calculationMethod,
            note: calculationMethod === 'estimated' ? 'APR estimated based on 5% network inflation (validator has no reward history)' : undefined
        };
    }

    // ============================================================================
    // BATCH APR CALCULATIONS
    // ============================================================================

    /**
     * Calculate APR for multiple validators for a single delegator
     */
    async calculateDelegatorAPRBatch(delegatorAddress, validatorAddresses, blockTime = 1) {
        const results = [];

        for (const validatorAddress of validatorAddresses) {
            const apr = await this.calculateDelegatorAPR(delegatorAddress, validatorAddress, blockTime);
            results.push({
                validator: validatorAddress,
                ...apr
            });
        }

        return {
            delegator: delegatorAddress,
            blockTime: blockTime,
            results: results,
            calculatedAt: new Date().toISOString()
        };
    }

    /**
     * Calculate average APR across all active validators
     */
    async calculateAverageAPR(blockTime = 1) {
        try {
            const activeValidators = await this.contract.getActivatedValidators();
            let totalAPR = 0;
            let validCalculations = 0;

            for (const validator of activeValidators) {
                const validatorInfo = await this.contract.getValidatorInfo(validator);
                const [rewardAddr, status, stakingAmount, commissionRate, rewardAmount] = validatorInfo;

                if (stakingAmount > 0) {
                    const aprData = blockTime === 1
                        ? this.calculateAPRFast(stakingAmount, rewardAmount, commissionRate, stakingAmount)
                        : this.calculateAPRSlow(stakingAmount, rewardAmount, commissionRate, stakingAmount);

                    totalAPR += parseFloat(aprData.apr);
                    validCalculations++;
                }
            }

            const averageAPR = validCalculations > 0 ? totalAPR / validCalculations : 0;

            return {
                success: true,
                data: {
                    averageAPR: averageAPR.toFixed(2),
                    averageAPRPercent: `${averageAPR.toFixed(2)}%`,
                    validatorsIncluded: validCalculations,
                    totalValidators: activeValidators.length,
                    blockTime: blockTime,
                    blockConfiguration: blockTime === 1 ? '1 second per block' : '5 seconds per block',
                    calculatedAt: new Date().toISOString()
                }
            };

        } catch (error) {
            return {
                success: false,
                error: 'AVERAGE_APR_ERROR',
                message: error.message
            };
        }
    }

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================

    /**
     * Format commission rate from basis points to percentage
     */
    formatCommissionRate(commissionRate) {
        try {
            // Convert BigInt to string first, then to Number
            const rateString = commissionRate ? commissionRate.toString() : this.config.DEFAULT_COMMISSION_RATE.toString();
            const rateBigInt = BigInt(rateString);

            // Check if rate is reasonable (should be <= 10000 for 100%)
            if (rateBigInt > 10000n) {
                console.warn('Suspicious commission rate detected:', rateString);
                // Use default rate if unreasonable
                const defaultRate = this.config.DEFAULT_COMMISSION_RATE / 10000;
                return {
                    percentage: `${(defaultRate * 100).toFixed(2)}%`,
                    basisPoints: this.config.DEFAULT_COMMISSION_RATE,
                    decimal: defaultRate,
                    warning: `Invalid rate ${rateString}, using default`
                };
            }

            const rate = Number(rateBigInt) / 10000;
            return {
                percentage: `${(rate * 100).toFixed(2)}%`,
                basisPoints: Number(rateBigInt),
                decimal: rate
            };

        } catch (error) {
            console.error('Error formatting commission rate:', error);
            const defaultRate = this.config.DEFAULT_COMMISSION_RATE / 10000;
            return {
                percentage: `${(defaultRate * 100).toFixed(2)}%`,
                basisPoints: this.config.DEFAULT_COMMISSION_RATE,
                decimal: defaultRate,
                error: error.message
            };
        }
    }

    /**
     * Get minimum stake requirement
     */
    getMinimumStake() {
        return {
            wei: this.config.MIN_DELEGATOR_STAKE.toString(),
            ether: ethers.formatEther(this.config.MIN_DELEGATOR_STAKE),
            formatted: `${ethers.formatEther(this.config.MIN_DELEGATOR_STAKE)} OXT`
        };
    }

    /**
     * Check if delegator meets minimum stake requirement
     */
    async checkMinimumStake(delegatorAddress, validatorAddress) {
        try {
            const stakingInfo = await this.contract.getStakingInfo(delegatorAddress, validatorAddress);
            const [delegatorStake] = stakingInfo;

            return {
                meetRequirement: delegatorStake >= this.config.MIN_DELEGATOR_STAKE,
                currentStake: ethers.formatEther(delegatorStake),
                minStake: ethers.formatEther(this.config.MIN_DELEGATOR_STAKE),
                difference: ethers.formatEther(
                    delegatorStake >= this.config.MIN_DELEGATOR_STAKE
                        ? delegatorStake - this.config.MIN_DELEGATOR_STAKE
                        : this.config.MIN_DELEGATOR_STAKE - delegatorStake
                )
            };
        } catch (error) {
            return {
                meetRequirement: false,
                error: error.message
            };
        }
    }

    // ========================================
    // CONFIGURATION UPDATE METHODS
    // ========================================

    /**
     * Update minimum stake requirement
     * @param {string} newMinStake - New minimum stake in ether (e.g., "1000")
     */
    updateMinimumStake(newMinStake) {
        this.config.MIN_DELEGATOR_STAKE = ethers.parseEther(newMinStake);
        return {
            updated: true,
            newMinStake: ethers.formatEther(this.config.MIN_DELEGATOR_STAKE)
        };
    }

    /**
     * Update block time configurations
     * @param {number} fastBlockTime - Fast block time in seconds
     * @param {number} slowBlockTime - Slow block time in seconds
     */
    updateBlockTimeConfig(fastBlockTime, slowBlockTime) {
        this.config.BLOCK_TIME_FAST = fastBlockTime;
        this.config.BLOCK_TIME_SLOW = slowBlockTime;

        // Recalculate blocks per year
        this.config.BLOCKS_PER_YEAR_FAST = this.config.SECONDS_PER_YEAR / fastBlockTime;
        this.config.BLOCKS_PER_YEAR_SLOW = this.config.SECONDS_PER_YEAR / slowBlockTime;

        return {
            updated: true,
            fastBlockTime: fastBlockTime,
            slowBlockTime: slowBlockTime,
            blocksPerYearFast: this.config.BLOCKS_PER_YEAR_FAST,
            blocksPerYearSlow: this.config.BLOCKS_PER_YEAR_SLOW
        };
    }

    /**
     * Get current configuration
     */
    getConfiguration() {
        return {
            minDelegatorStake: ethers.formatEther(this.config.MIN_DELEGATOR_STAKE),
            blockTimeFast: this.config.BLOCK_TIME_FAST,
            blockTimeSlow: this.config.BLOCK_TIME_SLOW,
            blocksPerYearFast: this.config.BLOCKS_PER_YEAR_FAST,
            blocksPerYearSlow: this.config.BLOCKS_PER_YEAR_SLOW,
            secondsPerYear: this.config.SECONDS_PER_YEAR,
            defaultCommissionRate: this.config.DEFAULT_COMMISSION_RATE
        };
    }
}

export default APRCalculatorService;