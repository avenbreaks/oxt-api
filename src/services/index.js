// ============================================================================
// SERVICES INDEX - EXPORT ALL SERVICES
// ============================================================================
// Central export untuk semua services termasuk APR Calculator
// ============================================================================

export { default as APRCalculatorService } from './aprCalculator.js';

// ========================================
// APR SERVICE INITIALIZATION HELPER
// ========================================
import APRCalculatorService from './aprCalculator.js';
import { ethers } from 'ethers';
import { Logger } from '../utils/logger.js';

const logger = new Logger('APR:Service');

/**
 * Initialize APR service dengan konfigurasi custom
 */
export const initAPRService = (config) => {
  const {
    provider,
    contractAddress,
    validatorABI,
    minStake = '1000',
    fastBlockTime = 1,
    slowBlockTime = 5,
    defaultCommission = 5000
  } = config;

  const aprService = new APRCalculatorService(provider, contractAddress, validatorABI);
  
  // Update konfigurasi jika ada parameter custom
  if (minStake !== '1000') {
    aprService.updateMinimumStake(minStake);
  }
  
  if (fastBlockTime !== 1 || slowBlockTime !== 5) {
    aprService.updateBlockTimeConfig(fastBlockTime, slowBlockTime);
  }

  return aprService;
};

// ============================================================================
// WEBSOCKET APR EVENTS INTEGRATION
// ============================================================================

export const aprWebSocketEvents = {
  /**
   * Broadcast APR updates ketika ada staking events
   */
  broadcastAPRUpdate: async (ws, eventData, aprService) => {
    if (!aprService) return;
    
    try {
      const { staker, validator, amount, eventType } = eventData;
      
      // Hitung APR terbaru untuk validator yang affected
      const [apr1s, apr5s] = await Promise.all([
        aprService.calculateDelegatorAPR(staker, validator, 1),
        aprService.calculateDelegatorAPR(staker, validator, 5)
      ]);
      
      if (apr1s.success && apr5s.success) {
        ws.send(JSON.stringify({
          type: 'aprUpdate',
          data: {
            validator,
            staker,
            eventType,
            amount,
            apr: {
              blockTime1s: apr1s.data,
              blockTime5s: apr5s.data
            },
            timestamp: new Date().toISOString()
          }
        }));
        
        logger.success('APR update broadcasted', { validator, staker, eventType });
      }
    } catch (error) {
      logger.error('Error broadcasting APR update:', error);
    }
  },

  /**
   * Broadcast average APR changes
   */
  broadcastAverageAPRUpdate: async (ws, aprService) => {
    if (!aprService) return;
    
    try {
      const [avgAPR1s, avgAPR5s] = await Promise.all([
        aprService.calculateAverageAPR(1),
        aprService.calculateAverageAPR(5)
      ]);
      
      if (avgAPR1s.success && avgAPR5s.success) {
        ws.send(JSON.stringify({
          type: 'averageAPRUpdate',
          data: {
            blockTime1s: avgAPR1s.data,
            blockTime5s: avgAPR5s.data,
            timestamp: new Date().toISOString()
          }
        }));
        
        logger.success('Average APR update broadcasted', {
          avgAPR1s: avgAPR1s.data.averageAPR,
          avgAPR5s: avgAPR5s.data.averageAPR
        });
      }
    } catch (error) {
      logger.error('Error broadcasting average APR update:', error);
    }
  }
};

// ============================================================================
// SERVICE ENHANCEMENT HELPERS
// ============================================================================

/**
 * Enhance validator service dengan APR integration
 */
export const enhanceValidatorService = (validatorService, aprService) => {
  if (!aprService) return validatorService;
  
  const originalGetValidator = validatorService.getValidator?.bind(validatorService);
  
  if (originalGetValidator) {
    validatorService.getValidator = async (address, includeAPR = false) => {
      const validator = await originalGetValidator(address);
      
      if (includeAPR && validator.success) {
        try {
          // Hitung theoretical APR untuk validator ini
          const [apr1s, apr5s] = await Promise.all([
            aprService.calculateDelegatorAPR('0x0000000000000000000000000000000000000001', address, 1),
            aprService.calculateDelegatorAPR('0x0000000000000000000000000000000000000001', address, 5)
          ]);
          
          validator.data.aprInfo = {
            blockTime1s: apr1s.success ? apr1s.data : null,
            blockTime5s: apr5s.success ? apr5s.data : null,
            note: 'Theoretical APR based on minimum stake'
          };
        } catch (error) {
          validator.data.aprInfo = {
            error: 'Failed to calculate APR',
            message: error.message
          };
        }
      }
      
      return validator;
    };
  }
  
  return validatorService;
};

/**
 * Enhance delegator service dengan APR integration
 */
export const enhanceDelegatorService = (delegatorService, aprService) => {
  if (!aprService) return delegatorService;
  
  const originalGetDelegator = delegatorService.getDelegator?.bind(delegatorService);
  
  if (originalGetDelegator) {
    delegatorService.getDelegator = async (address, includeAPR = false) => {
      const delegator = await originalGetDelegator(address);
      
      if (includeAPR && delegator.success && delegator.data.stakes) {
        try {
          // Hitung APR untuk semua validator yang di-stake delegator ini
          const aprPromises = delegator.data.stakes.map(async (stake) => {
            const [apr1s, apr5s] = await Promise.all([
              aprService.calculateDelegatorAPR(address, stake.validator, 1),
              aprService.calculateDelegatorAPR(address, stake.validator, 5)
            ]);
            
            return {
              validator: stake.validator,
              apr1s: apr1s.success ? apr1s.data : null,
              apr5s: apr5s.success ? apr5s.data : null
            };
          });
          
          const aprResults = await Promise.all(aprPromises);
          delegator.data.aprBreakdown = aprResults;
          
          // Calculate weighted average APR
          let totalStake = 0;
          let weightedAPR1s = 0;
          let weightedAPR5s = 0;
          
          aprResults.forEach((result, index) => {
            const stakeAmount = parseFloat(delegator.data.stakes[index].amount);
            totalStake += stakeAmount;
            
            if (result.apr1s) {
              weightedAPR1s += parseFloat(result.apr1s.apr) * stakeAmount;
            }
            if (result.apr5s) {
              weightedAPR5s += parseFloat(result.apr5s.apr) * stakeAmount;
            }
          });
          
          delegator.data.averageAPR = {
            blockTime1s: totalStake > 0 ? (weightedAPR1s / totalStake).toFixed(2) : '0.00',
            blockTime5s: totalStake > 0 ? (weightedAPR5s / totalStake).toFixed(2) : '0.00',
            note: 'Weighted average APR across all staked validators'
          };
          
        } catch (error) {
          delegator.data.aprInfo = {
            error: 'Failed to calculate APR breakdown',
            message: error.message
          };
        }
      }
      
      return delegator;
    };
  }
  
  return delegatorService;
};