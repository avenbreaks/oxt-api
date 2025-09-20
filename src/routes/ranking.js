import { Elysia } from 'elysia';
import { responseWrapper } from '../utils/response.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('Ranking');

export const rankingRoutes = (rankingService) => {
  return new Elysia({ prefix: '/api/ranking' })

    // Get delegator rankings with pagination
    .get('/delegators', async ({ query, set }) => {
      try {
        const page = parseInt(query.page) || 1;
        const limit = Math.min(parseInt(query.limit) || 50, 100); // Max 100 per page

        if (page < 1 || limit < 1) {
          set.status = 400;
          return responseWrapper.error('Invalid pagination parameters', 'INVALID_PARAMS');
        }

        logger.api('/api/ranking/delegators', 'GET', { page, limit });

        const result = await rankingService.calculateDelegatorRankings(page, limit);

        return responseWrapper.paginated(
          result.delegators,
          result.pagination,
          'Delegator rankings retrieved successfully'
        );

      } catch (error) {
        logger.error('Error getting delegator rankings:', error);
        set.status = 500;
        return responseWrapper.error('Failed to get delegator rankings', 'INTERNAL_ERROR');
      }
    })

    // Get specific delegator rank
    .get('/delegator/:address', async ({ params, set }) => {
      try {
        const { address } = params;

        if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
          set.status = 400;
          return responseWrapper.error('Invalid delegator address format', 'INVALID_ADDRESS');
        }

        logger.api(`/api/ranking/delegator/${address}`, 'GET');

        const result = await rankingService.getDelegatorRank(address);

        return responseWrapper.success(result, 'Delegator rank retrieved successfully');

      } catch (error) {
        logger.error('Error getting delegator rank:', error);
        set.status = 500;
        return responseWrapper.error('Failed to get delegator rank', 'INTERNAL_ERROR');
      }
    })

    // Get top delegators
    .get('/top', async ({ query, set }) => {
      try {
        const limit = Math.min(parseInt(query.limit) || 10, 50); // Max 50

        logger.api('/api/ranking/top', 'GET', { limit });

        const result = await rankingService.getTopDelegators(limit);

        return responseWrapper.success(result, 'Top delegators retrieved successfully');

      } catch (error) {
        logger.error('Error getting top delegators:', error);
        set.status = 500;
        return responseWrapper.error('Failed to get top delegators', 'INTERNAL_ERROR');
      }
    })

    // Get ranking statistics
    .get('/stats', async ({ set }) => {
      try {
        logger.api('/api/ranking/stats', 'GET');

        const result = await rankingService.calculateDelegatorRankings(1, 1);
        
        return responseWrapper.success(result.summary, 'Ranking statistics retrieved successfully');

      } catch (error) {
        logger.error('Error getting ranking stats:', error);
        set.status = 500;
        return responseWrapper.error('Failed to get ranking statistics', 'INTERNAL_ERROR');
      }
    });
};