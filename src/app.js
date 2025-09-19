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
import { config } from "./config/index.js";
import { WebSocketService } from "./services/websocket.js";

// Initialize WebSocket service
const wsService = new WebSocketService(
  config.rpc.url,
  config.contracts.validators
);

// Create main application
const app = new Elysia()
  .use(cors({
    origin: config.cors.origin
  }))
  .use(logger)
  .use(errorHandler)
  .use(validationMiddleware)
  
  // Register routes
  .use(healthRoutes)
  .use(validatorRoutes)
  .use(delegatorAndStakingRoutes)
  .use(statsRoutes)
  .use(websocketRoutes(wsService))

  // Global error handler
  .onError(({ error, code, set }) => {
    console.error('Unhandled error:', error);
    set.status = code === 'VALIDATION' ? 400 : 500;
    
    return {
      success: false,
      error: error.message,
      code,
      timestamp: new Date().toISOString()
    };
  });

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('Shutting down gracefully...');
  wsService.destroy();
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

export { app, wsService };