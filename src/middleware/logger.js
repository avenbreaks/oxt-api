import { Logger } from "../utils/logger.js";

const requestLogger = new Logger('API');

export const logger = (app) => app
  .onRequest(({ request, set }) => {
    const start = Date.now();
    const url = new URL(request.url);
    
    // Store start time for response logging
    set.headers['x-request-start'] = start.toString();
    
    // Extract useful info
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    // Store for response logging
    set.headers['x-client-ip'] = ip;
    set.headers['x-user-agent'] = userAgent;
  })
  .onResponse(({ request, set }) => {
    const startTime = parseInt(set.headers['x-request-start']) || Date.now();
    const duration = Date.now() - startTime;
    const status = set.status || 200;
    const url = new URL(request.url);
    const ip = set.headers['x-client-ip'];
    const userAgent = set.headers['x-user-agent'];
    
    // Only log API requests, skip health checks in production
    const shouldLog = process.env.NODE_ENV === 'development' || 
                     !url.pathname.includes('/health');
    
    if (shouldLog) {
      requestLogger.request(
        request.method, 
        url.pathname + (url.search || ''), 
        status, 
        duration,
        { ip, userAgent }
      );
    }
    
    // Clean up headers
    delete set.headers['x-request-start'];
    delete set.headers['x-client-ip']; 
    delete set.headers['x-user-agent'];
  });