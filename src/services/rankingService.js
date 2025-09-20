import { Logger } from '../utils/logger.js';
import { ethers } from 'ethers';

export class DelegatorRankingService {
    constructor(contract) {
        this.contract = contract;
        this.logger = new Logger('Ranking');
    }

    /**
     * Get all delegators across all validators with their total stakes
     */
    async getAllDelegators() {
        try {
            const activeValidators = await this.contract.getActivatedValidators();
            const delegatorMap = new Map();

            for (const validator of activeValidators) {
                const validatorInfo = await this.contract.getValidatorInfo(validator);
                const [, , , , , , stakers] = validatorInfo;

                for (const staker of stakers) {
                    const stakingInfo = await this.contract.getStakingInfo(staker, validator);
                    const [amount] = stakingInfo;

                    if (amount > 0n) {
                        const currentTotal = delegatorMap.get(staker) || 0n;
                        delegatorMap.set(staker, currentTotal + amount);
                    }
                }
            }

            return delegatorMap;
        } catch (error) {
            this.logger.error('Error getting all delegators:', error);
            throw error;
        }
    }

    /**
     * Calculate delegator rankings
     */
    async calculateDelegatorRankings(page = 1, limit = 50) {
        try {
            const delegatorMap = await this.getAllDelegators();

            // Convert to array and sort by stake amount
            const delegators = Array.from(delegatorMap.entries())
                .map(([address, totalStake]) => ({
                    address,
                    totalStake: ethers.formatEther(totalStake),
                    totalStakeWei: totalStake.toString()
                }))
                .sort((a, b) => {
                    // Sort by comparing BigInt values
                    const aWei = BigInt(a.totalStakeWei);
                    const bWei = BigInt(b.totalStakeWei);
                    if (aWei > bWei) return -1;
                    if (aWei < bWei) return 1;
                    return 0;
                });

            // Add ranking positions
            const rankedDelegators = delegators.map((delegator, index) => ({
                address: delegator.address,
                rank: index + 1,
                totalStake: delegator.totalStake,
                percentOfTotal: this.calculatePercentage(BigInt(delegator.totalStakeWei), delegators)
            }));

            // Pagination
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedResults = rankedDelegators.slice(startIndex, endIndex);

            return {
                delegators: paginatedResults,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(rankedDelegators.length / limit),
                    totalItems: rankedDelegators.length,
                    itemsPerPage: limit,
                    hasNext: endIndex < rankedDelegators.length,
                    hasPrev: page > 1
                },
                summary: {
                    totalDelegators: rankedDelegators.length,
                    totalStaked: ethers.formatEther(
                        rankedDelegators.reduce((sum, d) => sum + BigInt(d.totalStakeWei || '0'), 0n)
                    ),
                    averageStake: ethers.formatEther(
                        rankedDelegators.reduce((sum, d) => sum + BigInt(d.totalStakeWei || '0'), 0n) / BigInt(rankedDelegators.length || 1)
                    )
                }
            };

        } catch (error) {
            this.logger.error('Error calculating delegator rankings:', error);
            throw error;
        }
    }

    /**
     * Get specific delegator rank and details
     */
    async getDelegatorRank(delegatorAddress) {
        try {
            const delegatorMap = await this.getAllDelegators();
            const delegatorStake = delegatorMap.get(delegatorAddress) || 0n;

            if (delegatorStake === 0n) {
                return {
                    address: delegatorAddress,
                    rank: null,
                    totalStake: "0.0",
                    message: "Delegator not found or has no active stakes"
                };
            }

            // Count how many delegators have more stake
            let rank = 1;
            for (const [, stake] of delegatorMap) {
                if (stake > delegatorStake) {
                    rank++;
                }
            }

            // Get delegator's validator breakdown
            const validatorBreakdown = await this.getDelegatorValidatorBreakdown(delegatorAddress);

            return {
                address: delegatorAddress,
                rank: rank,
                totalStake: ethers.formatEther(delegatorStake), // ✅ Convert to string
                totalDelegators: delegatorMap.size,
                percentile: ((delegatorMap.size - rank + 1) / delegatorMap.size * 100).toFixed(2),
                validatorBreakdown: validatorBreakdown
            };

        } catch (error) {
            this.logger.error('Error getting delegator rank:', error);
            throw error;
        }
    }

    /**
     * Get delegator's stake breakdown by validator
     */
    async getDelegatorValidatorBreakdown(delegatorAddress) {
        try {
            const activeValidators = await this.contract.getActivatedValidators();
            const breakdown = [];

            for (const validator of activeValidators) {
                const stakingInfo = await this.contract.getStakingInfo(delegatorAddress, validator);
                const [amount] = stakingInfo;

                if (amount > 0n) {
                    breakdown.push({
                        validator: validator,
                        stake: ethers.formatEther(amount)
                    });
                }
            }

            return breakdown.sort((a, b) => parseFloat(b.stake) - parseFloat(a.stake));
        } catch (error) {
            this.logger.error('Error getting validator breakdown:', error);
            return [];
        }
    }

    /**
     * Calculate percentage of total stake
     */
    calculatePercentage(stake, allDelegators) {
        const totalStake = allDelegators.reduce((sum, d) => {
            const stakeWei = BigInt(d.totalStakeWei || '0');
            return sum + stakeWei;
        }, 0n);

        if (totalStake === 0n) return "0.00";

        // Convert to Number for percentage calculation
        const stakeNumber = Number(ethers.formatEther(stake));
        const totalNumber = Number(ethers.formatEther(totalStake));

        return ((stakeNumber / totalNumber) * 100).toFixed(4);
    }

    /**
     * Get top delegators by stake amount
     */
    async getTopDelegators(limit = 10) {
        try {
            const result = await this.calculateDelegatorRankings(1, limit);
            return {
                topDelegators: result.delegators,
                summary: result.summary
            };
        } catch (error) {
            this.logger.error('Error getting top delegators:', error);
            throw error;
        }
    }
}