const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const COLORS = {
  error: '\x1b[31m',   // Red
  warn: '\x1b[33m',    // Yellow
  info: '\x1b[36m',    // Cyan
  debug: '\x1b[35m',   // Magenta
  success: '\x1b[32m', // Green
  reset: '\x1b[0m'
};

export class Logger {
  constructor(namespace = 'App') {
    this.namespace = namespace;
    this.level = LOG_LEVELS[process.env.LOG_LEVEL || 'info'] || LOG_LEVELS.info;
  }

  _formatData(data) {
    if (!data || data.length === 0) return '';
    
    // Format objects as pretty JSON
    const formatted = data.map(item => {
      if (typeof item === 'object' && item !== null) {
        return JSON.stringify(item, null, 2);
      }
      return item;
    }).join(' ');
    
    return formatted ? `\n${formatted}` : '';
  }

  _log(level, message, ...args) {
    if (LOG_LEVELS[level] > this.level) return;

    const timestamp = new Date().toLocaleString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const color = COLORS[level];
    const reset = COLORS.reset;
    const formattedData = this._formatData(args);
    
    // Clean format without excessive details
    const logMessage = `${color}[${timestamp}] ${level.toUpperCase()} [${this.namespace}]${reset} ${message}${formattedData}`;
    
    switch (level) {
      case 'error':
        console.error(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'debug':
        console.debug(logMessage);
        break;
      default:
        console.log(logMessage);
    }
  }

  error(message, ...args) {
    this._log('error', message, ...args);
  }

  warn(message, ...args) {
    this._log('warn', message, ...args);
  }

  info(message, ...args) {
    this._log('info', message, ...args);
  }

  debug(message, ...args) {
    this._log('debug', message, ...args);
  }

  success(message, ...args) {
    this._log('success', message, ...args);
  }

  // HTTP request logging with clean format
  request(method, path, statusCode, duration, extra = {}) {
    const color = statusCode >= 400 ? COLORS.error : 
                  statusCode >= 300 ? COLORS.warn : 
                  COLORS.success;
    const reset = COLORS.reset;
    
    const timestamp = new Date().toLocaleString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    let logMessage = `${color}[${timestamp}] HTTP${reset} ${method} ${path} - ${statusCode} (${duration}ms)`;
    
    // Add extra info if provided
    if (extra.ip) {
      logMessage += ` from ${extra.ip}`;
    }
    if (extra.userAgent && process.env.LOG_LEVEL === 'debug') {
      logMessage += `\n  User-Agent: ${extra.userAgent}`;
    }
    
    console.log(logMessage);
  }

  // API specific logging
  api(endpoint, method, params = {}, result = null) {
    if (Object.keys(params).length > 0) {
      this.info(`${method} ${endpoint}`, { params });
    } else {
      this.info(`${method} ${endpoint}`);
    }
    
    if (result && process.env.LOG_LEVEL === 'debug') {
      this.debug(`Response for ${endpoint}:`, result);
    }
  }

  // Create child logger with extended namespace
  child(childNamespace) {
    return new Logger(`${this.namespace}:${childNamespace}`);
  }
}