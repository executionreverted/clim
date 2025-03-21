// components/FileExplorer/utils.js
import fs from 'fs/promises';  // Use promises version for async operations
import path from 'path';

/**
 * Load directory contents asynchronously and update state
 * @param {string} dirPath - Directory path to load
 * @returns {Promise<Array>} - Promise resolving to array of file/directory objects
 */
export const loadDirectoryAsync = async (dirPath) => {
  try {
    const itemNames = await fs.readdir(dirPath);

    // Use Promise.all to parallelize stat operations
    const itemPromises = itemNames.map(async (item) => {
      const itemPath = path.join(dirPath, item);
      try {
        const stats = await fs.stat(itemPath);
        return {
          name: item,
          path: itemPath,
          isDirectory: stats.isDirectory(),
          size: stats.size,
          mtime: stats.mtime
        };
      } catch (err) {
        // Handle individual file errors gracefully
        console.error(`Error reading stats for ${itemPath}:`, err);
        return {
          name: item,
          path: itemPath,
          isDirectory: false,
          size: 0,
          mtime: new Date(),
          error: err.message
        };
      }
    });

    const items = await Promise.all(itemPromises);

    // Sort: directories first, then files alphabetically
    return items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  } catch (err) {
    throw new Error(`Failed to read directory: ${err.message}`);
  }
};

/**
 * Read file contents with efficient handling of large files
 * @param {string} filePath - Path to the file
 * @param {number} maxSize - Maximum number of bytes to read for large files
 * @returns {Promise<string>} - File contents
 */
export const readFilePreview = async (filePath, maxSize = 50000) => {
  try {
    const stats = await fs.stat(filePath);

    // For small files, read the entire contents
    if (stats.size <= maxSize) {
      return await fs.readFile(filePath, 'utf-8');
    }

    // For large files, read just the beginning
    const buffer = Buffer.alloc(maxSize);
    const fileHandle = await fs.open(filePath, 'r');

    try {
      const { bytesRead } = await fileHandle.read(buffer, 0, maxSize, 0);
      const content = buffer.slice(0, bytesRead).toString('utf-8');
      return content + '\n\n[File truncated - too large to display completely]';
    } finally {
      await fileHandle.close();
    }
  } catch (err) {
    throw new Error(`Failed to read file: ${err.message}`);
  }
};

/**
 * Read directory contents with caching for improved performance
 */
const directoryCache = new Map();
const CACHE_TTL = 30000; // 30 seconds cache TTL

export const loadDirectoryWithCache = async (dirPath) => {
  const cacheKey = dirPath;
  const cachedData = directoryCache.get(cacheKey);

  if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
    return cachedData.data;
  }

  // Not in cache or cache expired
  const data = await loadDirectoryAsync(dirPath);
  directoryCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });

  return data;
};

/**
 * Determine if a file is a text file based on its MIME type
 * @param {string} mimeType - MIME type of the file
 * @returns {boolean} - Whether the file is a text file
 */
export const isTextFile = (mimeType) => {
  return mimeType.startsWith('text/') ||
    ['application/json', 'application/javascript', 'application/xml'].includes(mimeType);
};

/**
 * Enhanced sanitization of text content for terminal display
 * Handles a wide range of problematic characters that might break terminal rendering
 *
 * @param {string} text - Raw text content to sanitize
 * @returns {string} - Sanitized text safe for terminal display
 */

export const sanitizeTextForTerminal = (text) => {
  if (!text) return '';

  return text
    // Replace tabs with visible indicators
    .replace(/\t/g, '→   ')

    // Handle carriage returns
    .replace(/\r/g, '␍')

    // Strip ANSI color/control sequences
    .replace(/\u001b\[\d+(;\d+)*m/g, '')

    // Replace null bytes
    .replace(/\0/g, '␀')

    // Handle bidirectional text control characters
    .replace(/[\u2066-\u2069\u202A-\u202E\u061C]/g, '⤷')

    // Replace zero-width characters that can hide malicious content
    .replace(/[\u200B-\u200F\u2060\uFEFF]/g, '␣')

    // Handle emojis and other surrogate pairs
    .replace(/([\uD800-\uDBFF][\uDC00-\uDFFF])/g, '🔣')

    // Handle various space characters uniformly
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')

    // Replace vertical tabs and form feeds
    .replace(/[\u000B\u000C]/g, '⏎')

    // Replace private use area characters
    .replace(/[\uE000-\uF8FF]/g, '�')

    // Handle combining characters that can stack and break layout
    .replace(/[\u0300-\u036F\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]/g, '⌃')

    // Replace non-printable control characters
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, (c) => {
      if (c === '\n') return c; // Keep newlines
      return `␛${c.charCodeAt(0).toString(16).padStart(2, '0')}`;
    })

    // Replace unicode "replacement character" and similar problematic characters
    .replace(/[\uFFFD\uFFF9-\uFFFB]/g, '�')

    // Limit consecutive newlines to prevent "blank space" attacks
    .replace(/\n{3,}/g, '\n\n')

    // Handle line tabulation set/character tabulation set/etc.
    .replace(/[\u008A-\u008F]/g, '⇥');
};
