// source/utils/memory-management.js

/**
 * Memory management utility functions to prevent memory-related crashes
 */

/**
 * Check if the heap usage is near the limit
 * @returns {boolean} True if heap is near the limit
 */
export function isMemoryNearLimit() {
  if (typeof process === 'undefined' || !process.memoryUsage) {
    return false; // Not in Node.js environment
  }

  try {
    const { heapUsed, heapTotal } = process.memoryUsage();
    // Warning threshold: 85% of heap is used
    return (heapUsed / heapTotal) > 0.85;
  } catch (err) {
    console.error('Error checking memory usage:', err);
    return false;
  }
}

/**
 * Safely process large arrays/data by chunking
 * @param {Array} array The array to process
 * @param {Function} processFn Function to process each chunk
 * @param {Object} options Options for processing
 * @param {number} options.chunkSize Number of items to process in each chunk
 * @param {number} options.delay Delay between chunks in ms
 * @returns {Promise<Array>} Results from processing
 */
export async function processInChunks(array, processFn, options = {}) {
  const { chunkSize = 50, delay = 0 } = options;
  const results = [];

  for (let i = 0; i < array.length; i += chunkSize) {
    // Check memory before processing each chunk
    if (isMemoryNearLimit()) {
      // Force garbage collection if available (Node.js with --expose-gc flag)
      if (global.gc) {
        global.gc();
        // Wait for GC to complete
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        // If GC not available, add a longer delay to naturally allow GC
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const chunk = array.slice(i, i + chunkSize);
    const chunkResults = await processFn(chunk, i);

    if (Array.isArray(chunkResults)) {
      results.push(...chunkResults);
    } else if (chunkResults !== undefined) {
      results.push(chunkResults);
    }

    // Add delay between chunks if specified
    if (delay > 0 && i + chunkSize < array.length) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return results;
}

/**
 * Safely read a large file in chunks
 * @param {Function} readFn Function that performs the read operation
 * @param {Object} options Options for reading
 * @param {number} options.maxSize Maximum size to read in bytes
 * @param {number} options.chunkSize Size of each chunk to read
 * @returns {Promise<Buffer>} The file data
 */
export async function safelyReadFile(readFn, options = {}) {
  const { maxSize = 1024 * 1024, chunkSize = 64 * 1024 } = options;

  try {
    // If readFn returns a Promise<Buffer>, handle it directly
    const result = await readFn();

    if (Buffer.isBuffer(result)) {
      // If the result is too large, truncate it
      if (result.length > maxSize) {
        console.warn(`Large file detected (${result.length} bytes). Truncating to ${maxSize} bytes.`);
        return result.slice(0, maxSize);
      }
      return result;
    }

    // If readFn returns a stream, handle it as chunks
    if (typeof result.on === 'function' && typeof result.read === 'function') {
      return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        let truncated = false;

        result.on('data', (chunk) => {
          if (size + chunk.length <= maxSize) {
            chunks.push(chunk);
            size += chunk.length;
          } else if (!truncated) {
            // Add the partial chunk to reach exactly maxSize
            const remaining = maxSize - size;
            if (remaining > 0) {
              chunks.push(chunk.slice(0, remaining));
              size += remaining;
            }
            truncated = true;
            console.warn(`Large file stream truncated at ${maxSize} bytes.`);
          }
        });

        result.on('end', () => {
          resolve(Buffer.concat(chunks));
        });

        result.on('error', (err) => {
          reject(err);
        });
      });
    }

    // Default fallback
    return result;
  } catch (err) {
    console.error('Error safely reading file:', err);
    throw err;
  }
}

/**
 * Safe wrapper for string operations to prevent memory issues
 */
export const safeString = {
  /**
   * Safely truncate a string if it's too large
   * @param {string} str String to truncate
   * @param {number} maxLength Maximum length
   * @returns {string} Truncated string
   */
  truncate(str, maxLength = 1000000) {
    if (!str || typeof str !== 'string') return str;
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '\n[... truncated ...]';
  },

  /**
   * Safely split a string without loading all parts in memory
   * @param {string} str String to split
   * @param {string|RegExp} separator Split separator
   * @param {Object} options Options
   * @returns {Array} Generator for string parts
   */
  *safeSplit(str, separator, { limit = 1000, maxLength = 10000 } = {}) {
    if (!str || typeof str !== 'string') return;

    let start = 0;
    let count = 0;
    let nextIndex = -1;

    // Truncate input string if it's too large
    const safeStr = str.length > maxLength * 2 ?
      str.substring(0, maxLength * 2) : str;

    while (count < limit) {
      nextIndex = safeStr.indexOf(separator, start);

      if (nextIndex === -1) {
        // Last part
        if (start < safeStr.length) {
          yield safeStr.substring(start);
        }
        break;
      }

      yield safeStr.substring(start, nextIndex);

      start = nextIndex + (typeof separator === 'string' ? separator.length : 1);
      count++;

      // Check if we're at the end
      if (start >= safeStr.length) break;
    }
  }
};
