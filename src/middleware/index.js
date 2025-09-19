// Export all middleware
export { logger } from "./logger.js";
export { errorHandler } from "./errorHandler.js";
export { validationMiddleware } from "./validation.js";

// Additional middleware for future use
export const corsMiddleware = (app) => app
  .onRequest(({ set, request }) => {
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      set.status = 204;
      set.headers = {
        ...set.headers,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '3600'
      };
      return new Response(null, { status: 204 });
    }
  })
  .onResponse(({ set }) => {
    // Add CORS headers to all responses
    set.headers = {
      ...set.headers,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };
  });

export const securityMiddleware = (app) => app
  .onResponse(({ set }) => {
    // Add security headers
    set.headers = {
      ...set.headers,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };
  });