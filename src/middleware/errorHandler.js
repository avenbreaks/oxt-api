import { responseWrapper } from "../utils/response.js";
import { Logger } from "../utils/logger.js";

const errorLogger = new Logger('ErrorHandler');

export const errorHandler = (app) => app
  .onError(({ error, code, set, request }) => {
    const url = new URL(request.url);
    
    errorLogger.error(`Error in ${request.method} ${url.pathname}:`, {
      error: error.message,
      stack: error.stack,
      code
    });

    // Set appropriate HTTP status
    switch (code) {
      case 'VALIDATION':
        set.status = 400;
        break;
      case 'NOT_FOUND':
        set.status = 404;
        break;
      case 'UNAUTHORIZED':
        set.status = 401;
        break;
      case 'FORBIDDEN':
        set.status = 403;
        break;
      case 'RATE_LIMIT':
        set.status = 429;
        break;
      default:
        set.status = 500;
    }

    return responseWrapper.error(
      error.message,
      code,
      process.env.NODE_ENV === 'development' ? error.stack : undefined
    );
  });