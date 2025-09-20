import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { logger } from "./middleware/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { validationMiddleware } from "./middleware/validation.js";
import { healthRoutes } from "./routes/health.js";
import { validatorRoutes } from "./routes/validators.js";
import { delegatorAndStakingRoutes } from "./routes/delegators.js";
import { statsRoutes } from "./routes/stats.js";
import { websocketRoutes } from "./routes/websocket.js";
import { aprRoutes } from "./routes/apr.js";
import { rankingRoutes } from './routes/ranking.js';
import { config, APR_CONFIG } from "./config/index.js";
import { WebSocketService } from "./services/websocket.js";
import APRCalculatorService from "./services/aprCalculator.js";
import { DelegatorRankingService } from './services/rankingService.js';
import { ethers } from "ethers";
import validatorABI from "./abi/Validators.abi.json";
import { BlockchainService } from "./services/blockchain.js";

// ========================================
// PROVIDER INITIALIZATION - SHARED
// ========================================
const provider = new ethers.JsonRpcProvider(config.rpc.url);

// ========================================
// SERVICE INITIALIZATION
// ========================================
const initAPRService = (rpcUrl, contractAddress) => {
  try {
    // Initialize APR service with configuration
    const aprService = new APRCalculatorService(provider, contractAddress, validatorABI);
    
    // Update configurations from environment
    if (APR_CONFIG.MIN_DELEGATOR_STAKE !== '1000') {
      aprService.updateMinimumStake(APR_CONFIG.MIN_DELEGATOR_STAKE);
    }
    
    if (APR_CONFIG.FAST_BLOCK_TIME !== 1 || APR_CONFIG.SLOW_BLOCK_TIME !== 5) {
      aprService.updateBlockTimeConfig(APR_CONFIG.FAST_BLOCK_TIME, APR_CONFIG.SLOW_BLOCK_TIME);
    }
    
    console.log('✅ APR Calculator Service initialized');
    console.log(`   - Min Stake: ${APR_CONFIG.MIN_DELEGATOR_STAKE} OXT`);
    console.log(`   - Fast Block Time: ${APR_CONFIG.FAST_BLOCK_TIME}s`);
    console.log(`   - Slow Block Time: ${APR_CONFIG.SLOW_BLOCK_TIME}s`);
    
    return aprService;
    
  } catch (error) {
    console.error('❌ Failed to initialize APR Calculator Service:', error.message);
    return null;
  }
};

BigInt.prototype.toJSON = function() {
  return this.toString();
};

// Initialize services
const wsService = new WebSocketService(
  config.rpc.url,
  config.contracts.validators
);

const aprService = initAPRService(config.rpc.url, config.contracts.validators);

// Initialize Delegator Ranking Service
const rankingService = new DelegatorRankingService(
  new ethers.Contract(config.contracts.validators, validatorABI, provider)
);

// Create main application
const app = new Elysia()
  .onAfterHandle(({ response, set }) => {
    if (typeof response === 'object' && response !== null) {
      set.headers['content-type'] = 'application/json; charset=utf-8';
      
      const shouldPretty = process.env.PRETTY_JSON === 'true' || 
                          process.env.NODE_ENV === 'development';
      
      if (shouldPretty) {
        return JSON.stringify(response, null, 2);
      }
    }
    return response;
  })
  .use(cors({
    origin: config.cors.origin
  }))
  .use(logger)
  .use(errorHandler)
  .use(validationMiddleware)
  
  // Register existing routes
  .use(healthRoutes)
  .use(validatorRoutes)
  .use(delegatorAndStakingRoutes)
  .use(statsRoutes)
  .use(websocketRoutes(wsService))
  .use(rankingRoutes(rankingService)); // Add ranking routes

// ========================================
// APR ROUTES REGISTRATION - CONDITIONAL
// ========================================
if (aprService) {
  app.use(aprRoutes(aprService));
  app.decorate('aprService', aprService);
  console.log('✅ APR Routes registered successfully');
  console.log('   - Available at: /api/apr/*');
} else {
  console.log('⚠️  APR Routes disabled - APR service failed to initialize');
}

// Add service info to app context
app.decorate('hasAPRService', !!aprService);
app.decorate('rankingService', rankingService);

console.log('✅ Ranking Routes registered successfully');
console.log('   - Available at: /api/ranking/*');

// Enhanced error handler
app.onError(({ error, code, set }) => {
  console.error('Unhandled error:', error);
  set.status = code === 'VALIDATION' ? 400 : 500;
  
  return {
    success: false,
    error: error.message,
    code,
    aprServiceAvailable: !!aprService,
    rankingServiceAvailable: !!rankingService,
    timestamp: new Date().toISOString()
  };
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('Shutting down gracefully...');
  wsService.destroy();
  
  if (aprService) {
    console.log('APR Calculator Service cleanup completed');
  }
  
  console.log('Ranking Service cleanup completed');
  
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
await BlockchainService.initialize();

export { app, wsService, aprService, rankingService };