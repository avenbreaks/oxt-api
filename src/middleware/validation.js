import { responseWrapper } from "../utils/response.js";

export const validationMiddleware = (app) => app
  .onTransform(({ body, query, params, set }) => {
    // Add custom validation logic here if needed
    // This runs before route handlers
  })
  .onParse(({ body, headers }) => {
    // Custom parsing logic if needed
    if (headers['content-type']?.includes('application/json')) {
      try {
        return JSON.parse(body);
      } catch (error) {
        throw new Error('Invalid JSON body');
      }
    }
  });