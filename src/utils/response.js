export const responseWrapper = {
  success(data, message = 'Success', meta = {}) {
    return {
      success: true,
      data,
      message,
      meta: {
        ...meta,
        timestamp: new Date().toISOString()
      }
    };
  },

  error(message, code = 'INTERNAL_ERROR', details = null) {
    return {
      success: false,
      error: {
        message,
        code,
        details
      },
      timestamp: new Date().toISOString()
    };
  },

  validationError(errors, message = 'Validation failed') {
    return {
      success: false,
      error: {
        message,
        code: 'VALIDATION_ERROR',
        details: errors
      },
      timestamp: new Date().toISOString()
    };
  },

  paginated(data, pagination, meta = {}) {
    return {
      success: true,
      data,
      pagination: {
        currentPage: pagination.currentPage,
        totalPages: pagination.totalPages,
        totalItems: pagination.totalItems,
        itemsPerPage: pagination.itemsPerPage,
        hasNext: pagination.currentPage < pagination.totalPages,
        hasPrev: pagination.currentPage > 1
      },
      meta: {
        ...meta,
        timestamp: new Date().toISOString()
      }
    };
  },

  notFound(resource = 'Resource') {
    return {
      success: false,
      error: {
        message: `${resource} not found`,
        code: 'NOT_FOUND'
      },
      timestamp: new Date().toISOString()
    };
  },

  unauthorized(message = 'Unauthorized access') {
    return {
      success: false,
      error: {
        message,
        code: 'UNAUTHORIZED'
      },
      timestamp: new Date().toISOString()
    };
  },

  forbidden(message = 'Access forbidden') {
    return {
      success: false,
      error: {
        message,
        code: 'FORBIDDEN'
      },
      timestamp: new Date().toISOString()
    };
  },

  rateLimitExceeded(retryAfter = null) {
    return {
      success: false,
      error: {
        message: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter
      },
      timestamp: new Date().toISOString()
    };
  },

  serviceUnavailable(message = 'Service temporarily unavailable') {
    return {
      success: false,
      error: {
        message,
        code: 'SERVICE_UNAVAILABLE'
      },
      timestamp: new Date().toISOString()
    };
  }
};