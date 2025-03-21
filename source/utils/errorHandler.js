// utils/errorHandler.js
import fs from 'fs';
import path from 'path';
import os from 'os';

// Configuration
const LOG_DIRECTORY = path.join(os.homedir(), '.hyperchatters', 'logs');
const ERROR_LOG_FILE = path.join(LOG_DIRECTORY, 'error.log');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB max log size

/**
 * Ensures the log directory exists
 */
const ensureLogDirectory = () => {
  try {
    if (!fs.existsSync(LOG_DIRECTORY)) {
      fs.mkdirSync(LOG_DIRECTORY, { recursive: true });
    }
  } catch (err) {
    console.error(`Failed to create log directory: ${err.message}`);
  }
};

/**
 * Rotates log file if it gets too large
 */
const rotateLogFileIfNeeded = () => {
  try {
    if (fs.existsSync(ERROR_LOG_FILE)) {
      const stats = fs.statSync(ERROR_LOG_FILE);
      if (stats.size > MAX_LOG_SIZE) {
        const backupFile = `${ERROR_LOG_FILE}.${Date.now()}.backup`;
        fs.renameSync(ERROR_LOG_FILE, backupFile);
      }
    }
  } catch (err) {
    console.error(`Failed to rotate log file: ${err.message}`);
  }
};

/**
 * Log an error to file
 * @param {Error} error - Error object to log
 * @param {string} context - Context where the error occurred
 */
export const logError = (error, context = 'app') => {
  try {
    ensureLogDirectory();
    rotateLogFileIfNeeded();

    const timestamp = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stackTrace = error instanceof Error ? error.stack : 'No stack trace';

    const logEntry = `[${timestamp}] [${context}] ${errorMessage}\n${stackTrace}\n\n`;

    fs.appendFileSync(ERROR_LOG_FILE, logEntry);
  } catch (err) {
    console.error(`Failed to log error: ${err.message}`);
  }
};

/**
 * Function wrapper for async functions that handles errors
 * @param {Function} fn - Async function to wrap
 * @param {Object} options - Options
 * @param {string} options.context - Context for error logging
 * @param {Function} options.onError - Custom error handler
 * @param {boolean} options.rethrow - Whether to rethrow the error
 * @returns {Function} - Wrapped function
 */
export const withErrorHandling = (fn, options = {}) => {
  const { context = 'app', onError, rethrow = false } = options;

  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      logError(error, context);

      if (onError) {
        onError(error);
      }

      if (rethrow) {
        throw error;
      }

      // Return a default value or error object
      return { error: error.message };
    }
  };
};

/**
 * Higher order component for error boundary functionality
 * @param {React.Component} Component - Component to wrap
 * @param {Object} options - Options
 * @param {Function} options.fallback - Fallback component
 * @param {string} options.context - Context for error logging
 * @returns {React.Component} - Wrapped component
 */
export const withErrorBoundary = (Component, options = {}) => {
  const { fallback, context = 'component' } = options;

  return class ErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
      return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
      logError(error, `${context}: ${errorInfo.componentStack}`);
    }

    render() {
      if (this.state.hasError) {
        if (fallback) {
          return fallback(this.state.error);
        }

        return (
          <Box flexDirection="column" padding={1}>
            <Text color="red" bold>An error occurred</Text>
            <Text color="red">{this.state.error?.message || 'Unknown error'}</Text>
            <Text>The application will continue to function, but this component may not work properly.</Text>
          </Box>
        );
      }

      return <Component {...this.props} />;
    }
  };
};

/**
 * Utility to retry an async operation with backoff
 * @param {Function} operation - Async function to retry
 * @param {Object} options - Options
 * @param {number} options.retries - Number of retries
 * @param {number} options.baseDelay - Base delay between retries in ms
 * @param {number} options.maxDelay - Maximum delay between retries in ms
 * @returns {Promise} - Result of the operation
 */
export const retryWithBackoff = async (operation, options = {}) => {
  const {
    retries = 3,
    baseDelay = 300,
    maxDelay = 3000,
    context = 'retry'
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === retries) {
        logError(error, `${context} (final attempt)`);
        throw error;
      }

      logError(error, `${context} (attempt ${attempt + 1}/${retries})`);

      // Calculate delay with exponential backoff
      const delay = Math.min(
        maxDelay,
        baseDelay * Math.pow(2, attempt)
      );

      // Add some randomness to prevent thundering herd
      const jitter = Math.random() * 100;

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
    }
  }

  throw lastError;
};

export default {
  logError,
  withErrorHandling,
  withErrorBoundary,
  retryWithBackoff
};
