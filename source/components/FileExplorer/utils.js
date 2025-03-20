// components/FileExplorer/utils.js
import fs from 'fs';
import path from 'path';

/**
 * Load directory contents and update state
 * @param {string} dirPath - Directory path to load
 * @param {Function} setFiles - State setter for files array
 * @param {Function} setSelectedIndex - State setter for selected index
 * @param {Function} setError - State setter for error message
 * @param {Function} setVisibleStartIndex - State setter for visible start index
 */
export const loadDirectory = (dirPath, setFiles, setSelectedIndex, setError, setVisibleStartIndex) => {
  try {
    const items = fs.readdirSync(dirPath).map(item => {
      const itemPath = path.join(dirPath, item);
      const stats = fs.statSync(itemPath);
      return {
        name: item,
        path: itemPath,
        isDirectory: stats.isDirectory(),
        size: stats.size,
        mtime: stats.mtime
      };
    });

    // Sort: directories first, then files alphabetically
    const sortedItems = items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    setFiles(sortedItems);
    // We'll set selected index to -1 in the component to select the ".." item
    setVisibleStartIndex(0);
    setError('');
  } catch (err) {
    setError(`Error: ${err.message}`);
    setFiles([]);
  }
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
 * Sanitize text content for terminal display
 * Replaces or handles problematic characters that might break terminal rendering
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

    // Replace non-printable control characters
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, (c) => {
      if (c === '\n') return c; // Keep newlines
      return `␛${c.charCodeAt(0).toString(16).padStart(2, '0')}`;
    })

    // Replace unicode "replacement character" that appears for invalid sequences
    .replace(/\uFFFD/g, '�');
};
