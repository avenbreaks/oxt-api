// ============================================================================
// APR ROUTES FOR OXT API
// ============================================================================
// Routes untuk menghitung APR delegator dengan konfigurasi block time
// Easy modification tags untuk konfigurasi
// ============================================================================

import { Elysia } from 'elysia';
import APRCalculatorService from '../services/aprCalculator.js';
import { responseWrapper } from '../utils/response.js';
import { Logger } from '../utils/logger.js';

// Create logger instance for APR routes
const logger = new Logger('APR');

// ========================================
// ROUTE CONFIGURATION - EASY TO MODIFY
// ========================================
const ROUTE_CONFIG = {
    // Default block time (1 atau 5)
    DEFAULT_BLOCK_TIME: 1,

    // Rate limiting untuk APR endpoints
    RATE_LIMIT: {
        max: 60,
        window: 60000 // 1 minute
    },

    // Cache duration untuk APR results (dalam detik)
    CACHE_DURATION: 30,

    // Maximum validators untuk batch calculation
    MAX_VALIDATORS_BATCH: 50
};

export const aprRoutes = (aprCalculatorService) => {
    return new Elysia({ prefix: '/api/apr' })

        // ====================================================================
        // INDIVIDUAL DELEGATOR APR CALCULATION
        // ====================================================================
        .get('/delegator/:delegatorAddress/validator/:validatorAddress', async ({ params, query, set }) => {
            try {
                const { delegatorAddress, validatorAddress } = params;
                const blockTime = parseInt(query.blockTime) || ROUTE_CONFIG.DEFAULT_BLOCK_TIME;

                // Validate block time
                if (blockTime !== 1 && blockTime !== 5) {
                    set.status = 400;
                    return responseWrapper.error(
                        'Block time must be either 1 or 5 seconds',
                        'INVALID_BLOCK_TIME',
                        { validOptions: [1, 5] }
                    );
                }

                // Validate addresses
                if (!delegatorAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
                    set.status = 400;
                    return responseWrapper.error('Invalid delegator address format', 'INVALID_DELEGATOR_ADDRESS');
                }

                if (!validatorAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
                    set.status = 400;
                    return responseWrapper.error('Invalid validator address format', 'INVALID_VALIDATOR_ADDRESS');
                }

                logger.api(`/api/apr/delegator/${delegatorAddress}/validator/${validatorAddress}`, 'GET', { blockTime });

                const result = await aprCalculatorService.calculateDelegatorAPR(
                    delegatorAddress,
                    validatorAddress,
                    blockTime
                );

                if (!result.success) {
                    set.status = 400;
                    return responseWrapper.error(result.message, result.error, result);
                }

                logger.info('APR calculated successfully', {
                    delegator: delegatorAddress,
                    validator: validatorAddress,
                    blockTime,
                    apr: result.data.apr
                });

                return responseWrapper.success(result.data, 'APR calculated successfully');

            } catch (error) {
                logger.error('Error calculating delegator APR:', error);
                set.status = 500;
                return responseWrapper.error('Failed to calculate APR', 'INTERNAL_ERROR');
            }
        })

        // ====================================================================
        // BATCH APR CALCULATION FOR MULTIPLE VALIDATORS
        // ====================================================================
        .post('/delegator/:delegatorAddress/batch', async ({ params, body, set }) => {
            try {
                const { delegatorAddress } = params;
                const { validatorAddresses, blockTime = ROUTE_CONFIG.DEFAULT_BLOCK_TIME } = body;

                // Validate input
                if (!Array.isArray(validatorAddresses) || validatorAddresses.length === 0) {
                    set.status = 400;
                    return responseWrapper.validationError(
                        { validatorAddresses: 'Must be a non-empty array' },
                        'validatorAddresses must be a non-empty array'
                    );
                }

                if (validatorAddresses.length > ROUTE_CONFIG.MAX_VALIDATORS_BATCH) {
                    set.status = 400;
                    return responseWrapper.error(
                        `Maximum ${ROUTE_CONFIG.MAX_VALIDATORS_BATCH} validators allowed per batch`,
                        'TOO_MANY_VALIDATORS'
                    );
                }

                if (blockTime !== 1 && blockTime !== 5) {
                    set.status = 400;
                    return responseWrapper.error(
                        'Block time must be either 1 or 5 seconds',
                        'INVALID_BLOCK_TIME'
                    );
                }

                logger.api(`/api/apr/delegator/${delegatorAddress}/batch`, 'POST', {
                    validatorCount: validatorAddresses.length,
                    blockTime
                });

                const result = await aprCalculatorService.calculateDelegatorAPRBatch(
                    delegatorAddress,
                    validatorAddresses,
                    blockTime
                );

                logger.success('Batch APR calculation completed', {
                    delegator: delegatorAddress,
                    validatorCount: validatorAddresses.length
                });

                return responseWrapper.success(result, 'Batch APR calculation completed');

            } catch (error) {
                logger.error('Error in batch APR calculation:', error);
                set.status = 500;
                return responseWrapper.error('Failed to calculate batch APR', 'INTERNAL_ERROR');
            }
        })

        // ====================================================================
        // AVERAGE APR ACROSS ALL VALIDATORS
        // ====================================================================
        .get('/average', async ({ query, set }) => {
            try {
                const blockTime = parseInt(query.blockTime) || ROUTE_CONFIG.DEFAULT_BLOCK_TIME;

                if (blockTime !== 1 && blockTime !== 5) {
                    set.status = 400;
                    return responseWrapper.error(
                        'Block time must be either 1 or 5 seconds',
                        'INVALID_BLOCK_TIME'
                    );
                }

                logger.api('/api/apr/average', 'GET', { blockTime });

                const result = await aprCalculatorService.calculateAverageAPR(blockTime);

                if (!result.success) {
                    set.status = 500;
                    return responseWrapper.error(result.message, result.error);
                }

                logger.success('Average APR calculated', {
                    averageAPR: result.data.averageAPR,
                    validatorsIncluded: result.data.validatorsIncluded
                });

                return responseWrapper.success(result.data, 'Average APR calculated successfully');

            } catch (error) {
                logger.error('Error calculating average APR:', error);
                set.status = 500;
                return responseWrapper.error('Failed to calculate average APR', 'INTERNAL_ERROR');
            }
        })

        // ====================================================================
        // APR COMPARISON BETWEEN BLOCK TIMES
        // ====================================================================
        .get('/delegator/:delegatorAddress/validator/:validatorAddress/compare', async ({ params, set }) => {
            try {
                const { delegatorAddress, validatorAddress } = params;

                logger.api(`/api/apr/delegator/${delegatorAddress}/validator/${validatorAddress}/compare`, 'GET');

                // Calculate APR for both block times
                const [apr1s, apr5s] = await Promise.all([
                    aprCalculatorService.calculateDelegatorAPR(delegatorAddress, validatorAddress, 1),
                    aprCalculatorService.calculateDelegatorAPR(delegatorAddress, validatorAddress, 5)
                ]);

                if (!apr1s.success || !apr5s.success) {
                    const failedResult = !apr1s.success ? apr1s : apr5s;
                    set.status = 400;
                    return responseWrapper.error(failedResult.message, failedResult.error);
                }

                const comparison = {
                    delegator: delegatorAddress,
                    validator: validatorAddress,
                    blockTime1s: apr1s.data,
                    blockTime5s: apr5s.data,
                    difference: {
                        apr: (parseFloat(apr1s.data.apr) - parseFloat(apr5s.data.apr)).toFixed(2),
                        aprPercent: `${(parseFloat(apr1s.data.apr) - parseFloat(apr5s.data.apr)).toFixed(2)}%`,
                        description: parseFloat(apr1s.data.apr) > parseFloat(apr5s.data.apr)
                            ? '1s block time provides higher APR'
                            : '5s block time provides higher APR'
                    },
                    calculatedAt: new Date().toISOString()
                };

                logger.success('APR comparison completed', {
                    apr1s: apr1s.data.apr,
                    apr5s: apr5s.data.apr,
                    difference: comparison.difference.apr
                });

                return responseWrapper.success(comparison, 'APR comparison completed');

            } catch (error) {
                logger.error('Error comparing APR:', error);
                set.status = 500;
                return responseWrapper.error('Failed to compare APR', 'INTERNAL_ERROR');
            }
        })

        // ====================================================================
        // MINIMUM STAKE VALIDATION
        // ====================================================================
        .get('/delegator/:delegatorAddress/validator/:validatorAddress/stake-check', async ({ params, set }) => {
            try {
                const { delegatorAddress, validatorAddress } = params;

                logger.api(`/api/apr/delegator/${delegatorAddress}/validator/${validatorAddress}/stake-check`, 'GET');

                const result = await aprCalculatorService.checkMinimumStake(delegatorAddress, validatorAddress);

                if (result.error) {
                    set.status = 400;
                    return responseWrapper.error(result.error, 'STAKE_CHECK_ERROR');
                }

                logger.info('Minimum stake check completed', {
                    meetRequirement: result.meetRequirement,
                    currentStake: result.currentStake
                });

                return responseWrapper.success(result, 'Minimum stake check completed');

            } catch (error) {
                logger.error('Error checking minimum stake:', error);
                set.status = 500;
                return responseWrapper.error('Failed to check minimum stake', 'INTERNAL_ERROR');
            }
        })

        // ====================================================================
        // APR CALCULATOR CONFIGURATION
        // ====================================================================
        .get('/config', async ({ set }) => {
            try {
                const config = aprCalculatorService.getConfiguration();
                const minStake = aprCalculatorService.getMinimumStake();

                const fullConfig = {
                    ...config,
                    minStakeDetails: minStake,
                    routeConfig: {
                        defaultBlockTime: ROUTE_CONFIG.DEFAULT_BLOCK_TIME,
                        maxValidatorsBatch: ROUTE_CONFIG.MAX_VALIDATORS_BATCH,
                        cacheDuration: ROUTE_CONFIG.CACHE_DURATION
                    },
                    supportedBlockTimes: [1, 5],
                    calculationMethod: 'Based on validator rewards and total staking amount'
                };

                logger.api('/api/apr/config', 'GET');
                logger.debug('APR configuration retrieved', fullConfig);

                return responseWrapper.success(fullConfig, 'APR calculator configuration');

            } catch (error) {
                logger.error('Error getting APR config:', error);
                set.status = 500;
                return responseWrapper.error('Failed to get configuration', 'INTERNAL_ERROR');
            }
        })

        // ====================================================================
        // VALIDATOR SPECIFIC APR (without specific delegator)
        // ====================================================================
        .get('/validator/:validatorAddress', async ({ params, query, set }) => {
            try {
                const { validatorAddress } = params;
                const blockTime = parseInt(query.blockTime) || ROUTE_CONFIG.DEFAULT_BLOCK_TIME;

                if (blockTime !== 1 && blockTime !== 5) {
                    set.status = 400;
                    return responseWrapper.error('Block time must be either 1 or 5 seconds', 'INVALID_BLOCK_TIME');
                }

                // Use minimum stake as example calculation
                const minStakeAddress = '0x0000000000000000000000000000000000000001'; // Placeholder

                logger.api(`/api/apr/validator/${validatorAddress}`, 'GET', { blockTime });

                // Get validator info for APR calculation
                const result = await aprCalculatorService.calculateDelegatorAPR(
                    minStakeAddress,
                    validatorAddress,
                    blockTime,
                    true  // Skip minimum stake check for theoretical calculation
                );


                // Override the result to show theoretical APR
                if (result.success) {
                    result.data.note = 'Theoretical APR based on minimum stake requirement';
                    result.data.delegator = 'theoretical';
                }

                if (!result.success) {
                    set.status = 400;
                    return responseWrapper.error(result.message, result.error);
                }

                logger.success('Validator APR calculated', {
                    validator: validatorAddress,
                    theoreticalAPR: result.data.apr
                });

                return responseWrapper.success(result.data, 'Validator APR calculated successfully');

            } catch (error) {
                logger.error('Error calculating validator APR:', error);
                set.status = 500;
                return responseWrapper.error('Failed to calculate validator APR', 'INTERNAL_ERROR');
            }
        })

        // ====================================================================
        // TOP VALIDATORS BY APR
        // ====================================================================
        .get('/top-validators', async ({ query, set }) => {
            try {
                const blockTime = parseInt(query.blockTime) || ROUTE_CONFIG.DEFAULT_BLOCK_TIME;
                const limit = parseInt(query.limit) || 10;

                if (blockTime !== 1 && blockTime !== 5) {
                    set.status = 400;
                    return responseWrapper.error('Block time must be either 1 or 5 seconds', 'INVALID_BLOCK_TIME');
                }

                logger.api('/api/apr/top-validators', 'GET', { blockTime, limit });

                // This would require implementing a method to rank validators by APR
                // For now, return placeholder structure
                const result = {
                    blockTime: blockTime,
                    limit: limit,
                    message: 'Feature coming soon - top validators by APR ranking',
                    note: 'This endpoint will return validators ranked by their APR rates'
                };

                logger.info('Top validators APR ranking requested', { blockTime, limit });

                return responseWrapper.success(result, 'Top validators APR ranking');

            } catch (error) {
                logger.error('Error getting top validators by APR:', error);
                set.status = 500;
                return responseWrapper.error('Failed to get top validators', 'INTERNAL_ERROR');
            }
        });
};

// ============================================================================
// HELPER FUNCTIONS FOR APR ROUTES
// ============================================================================

/**
 * Middleware untuk caching APR results
 */
export const aprCacheMiddleware = (cache) => {
    const logger = new Logger('APR:Cache');

    return (app) => {
        app.derive(async ({ request, set }) => {
            const url = new URL(request.url);
            const cacheKey = `apr:${url.pathname}:${url.search}`;

            // Check cache
            const cached = cache.get(cacheKey);
            if (cached) {
                set.headers['x-cache'] = 'HIT';
                logger.debug('Cache hit for APR request', { cacheKey });
                return cached;
            }

            set.headers['x-cache'] = 'MISS';
            logger.debug('Cache miss for APR request', { cacheKey });
            return null;
        });
    };
};

/**
 * Update route configuration
 */
export const updateRouteConfig = (newConfig) => {
    const logger = new Logger('APR:Config');
    Object.assign(ROUTE_CONFIG, newConfig);
    logger.success('APR route configuration updated', newConfig);
    return ROUTE_CONFIG;
};