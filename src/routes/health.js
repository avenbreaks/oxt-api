import { Elysia } from "elysia";
import { BlockchainService } from "../services/blockchain.js";
import { responseWrapper } from "../utils/response.js";

export const healthRoutes = new Elysia()
  
  // Basic health check
  .get('/health', () => {
    return responseWrapper.success({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0'
    });
  })
  
  // Detailed health check
  .get('/health/detailed', async () => {
    try {
      const networkInfo = await BlockchainService.getNetworkInfo().catch(() => null);

      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0',
        services: {
          blockchain: networkInfo ? 'healthy' : 'unhealthy'
        },
        system: {
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
          },
          cpu: {
            uptime: process.uptime()
          }
        }
      };

      // Determine overall health
      const unhealthyServices = Object.values(health.services).filter(status => status !== 'healthy');
      if (unhealthyServices.length > 0) {
        health.status = 'degraded';
      }

      return responseWrapper.success(health);

    } catch (error) {
      return responseWrapper.error('Health check failed', 'HEALTH_CHECK_ERROR', error.message);
    }
  })

  // Ready check (for Kubernetes)
  .get('/ready', async () => {
    try {
      // Check if blockchain connection is ready
      await BlockchainService.getCurrentBlock();
      
      return responseWrapper.success({
        status: 'ready',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      return responseWrapper.serviceUnavailable('Service not ready');
    }
  })

  // Live check (for Kubernetes)  
  .get('/live', () => {
    return responseWrapper.success({
      status: 'alive',
      timestamp: new Date().toISOString()
    });
  });