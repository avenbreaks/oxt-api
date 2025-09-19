import { ethers } from "ethers";

/**
 * Validate Ethereum address
 */
export function validateAddress(address) {
  try {
    ethers.getAddress(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate and normalize Ethereum address
 */
export function normalizeAddress(address) {
  try {
    return ethers.getAddress(address);
  } catch (error) {
    throw new Error(`Invalid address: ${address}`);
  }
}

/**
 * Validate pagination parameters
 */
export function validatePagination(page, limit) {
  const errors = [];
  
  if (page !== undefined) {
    const pageNum = parseInt(page);
    if (isNaN(pageNum) || pageNum < 1) {
      errors.push('Page must be a positive integer');
    }
  }
  
  if (limit !== undefined) {
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      errors.push('Limit must be between 1 and 100');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    normalized: {
      page: Math.max(1, parseInt(page) || 1),
      limit: Math.min(100, Math.max(1, parseInt(limit) || 20))
    }
  };
}

/**
 * Validate sort parameters
 */
export function validateSort(sortBy, sortOrder, allowedFields = []) {
  const errors = [];
  
  if (sortBy && allowedFields.length > 0 && !allowedFields.includes(sortBy)) {
    errors.push(`Invalid sort field. Allowed fields: ${allowedFields.join(', ')}`);
  }
  
  if (sortOrder && !['asc', 'desc'].includes(sortOrder.toLowerCase())) {
    errors.push('Sort order must be "asc" or "desc"');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    normalized: {
      sortBy: sortBy || 'createdAt',
      sortOrder: (sortOrder || 'desc').toLowerCase()
    }
  };
}

/**
 * Validate search query
 */
export function validateSearchQuery(query) {
  const errors = [];
  
  if (!query || typeof query !== 'string') {
    errors.push('Search query is required and must be a string');
  } else if (query.length < 2) {
    errors.push('Search query must be at least 2 characters long');
  } else if (query.length > 100) {
    errors.push('Search query must be less than 100 characters');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    normalized: query ? query.trim() : ''
  };
}

/**
 * Validate numeric range
 */
export function validateNumericRange(value, min, max, fieldName = 'Value') {
  const errors = [];
  const num = parseFloat(value);
  
  if (isNaN(num)) {
    errors.push(`${fieldName} must be a number`);
  } else {
    if (min !== undefined && num < min) {
      errors.push(`${fieldName} must be at least ${min}`);
    }
    if (max !== undefined && num > max) {
      errors.push(`${fieldName} must be at most ${max}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    value: num
  };
}

/**
 * Validate date range
 */
export function validateDateRange(startDate, endDate) {
  const errors = [];
  let start, end;
  
  if (startDate) {
    start = new Date(startDate);
    if (isNaN(start.getTime())) {
      errors.push('Invalid start date format');
    }
  }
  
  if (endDate) {
    end = new Date(endDate);
    if (isNaN(end.getTime())) {
      errors.push('Invalid end date format');
    }
  }
  
  if (start && end && start > end) {
    errors.push('Start date must be before end date');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    normalized: {
      startDate: start ? start.toISOString() : null,
      endDate: end ? end.toISOString() : null
    }
  };
}

/**
 * Validate Wei amount (for token amounts)
 */
export function validateWeiAmount(amount) {
  const errors = [];
  
  try {
    const wei = ethers.parseEther(amount.toString());
    if (wei < 0n) {
      errors.push('Amount must be positive');
    }
    return {
      isValid: errors.length === 0,
      errors,
      wei: wei.toString(),
      ether: ethers.formatEther(wei)
    };
  } catch (error) {
    errors.push('Invalid amount format');
    return {
      isValid: false,
      errors,
      wei: null,
      ether: null
    };
  }
}

/**
 * Sanitize string input
 */
export function sanitizeString(input, maxLength = 255) {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>'"]/g, ''); // Basic XSS protection
}

/**
 * Validate commission rate (0-100%)
 */
export function validateCommissionRate(rate) {
  const errors = [];
  const num = parseFloat(rate);
  
  if (isNaN(num)) {
    errors.push('Commission rate must be a number');
  } else if (num < 0 || num > 100) {
    errors.push('Commission rate must be between 0 and 100');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    rate: num / 100, // Convert to decimal
    percentage: num
  };
}

/**
 * Validate validator description fields
 */
export function validateValidatorDescription(description) {
  const errors = [];
  const { moniker, website, email, details } = description;
  
  if (!moniker || moniker.trim().length < 3) {
    errors.push('Moniker must be at least 3 characters long');
  } else if (moniker.length > 50) {
    errors.push('Moniker must be less than 50 characters');
  }
  
  if (website && !/^https?:\/\/.+/.test(website)) {
    errors.push('Website must be a valid URL starting with http:// or https://');
  }
  
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Email must be a valid email address');
  }
  
  if (details && details.length > 500) {
    errors.push('Details must be less than 500 characters');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    normalized: {
      moniker: sanitizeString(moniker, 50),
      website: sanitizeString(website, 100),
      email: sanitizeString(email, 100),
      details: sanitizeString(details, 500)
    }
  };
}