import { app } from "./src/app.js";
import { config } from "./src/config/index.js";
import { BlockchainService } from "./src/services/blockchain.js";
import { Logger } from "./src/utils/logger.js";

const logger = new Logger('Server');

function printBanner() {
  const banner = `
╔═══════════════════════════════════════════════════════════════╗
║                🚀 ADERA VALIDATOR DASHBOARD API                ║
╠═══════════════════════════════════════════════════════════════╣
║  Environment: ${config.server.env.padEnd(47)} ║
║  Port:        ${config.server.port.toString().padEnd(47)} ║
║  RPC:         ${config.rpc.url.slice(0, 47).padEnd(47)} ║
║  Contract:    ${config.contracts.validators.slice(0, 47).padEnd(47)} ║
╠═══════════════════════════════════════════════════════════════╣
║  📊 Health:    http://localhost:${config.server.port}/health${' '.repeat(21)} ║
║  🔌 WebSocket: ws://localhost:${config.server.port}/ws${' '.repeat(24)} ║
║  📖 API Docs:  http://localhost:${config.server.port}/api/config${' '.repeat(18)} ║
╚═══════════════════════════════════════════════════════════════╝
`;
  console.log(banner);
}

async function startServer() {
  try {
    // Clear console for clean start
    if (process.env.NODE_ENV === 'development') {
      console.clear();
    }

    // Print banner
    printBanner();

    // Initialize blockchain connection
    logger.info('Initializing blockchain connection...');
    const connected = await BlockchainService.initialize();
    
    if (connected) {
      logger.success('Blockchain connection established');
    } else {
      logger.warn('Blockchain connection failed, running in offline mode');
    }

    // Start server
    app.listen(config.server.port, () => {
      logger.success(`API server started on port ${config.server.port}`);
      logger.info('Ready to accept requests');
      
      // Log configuration in debug mode
      if (process.env.LOG_LEVEL === 'debug') {
        logger.debug('Server configuration:', {
          port: config.server.port,
          environment: config.server.env,
          rpcUrl: config.rpc.url,
          contractAddress: config.contracts.validators,
          logLevel: process.env.LOG_LEVEL,
          logBlocks: process.env.LOG_BLOCKS === 'true'
        });
      }
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

startServer();