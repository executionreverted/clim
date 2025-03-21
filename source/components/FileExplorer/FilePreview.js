// components/FileExplorer/FilePreview.js
import React, { useEffect, useState, useCallback, memo } from 'react';
import { Box, Text, useInput } from 'ink';
import fs from 'fs/promises';
import mime from 'mime-types';
import { filesize } from 'filesize';
import { sanitizeTextForTerminal } from './utils.js';
import path from 'path';

// Constants for file handling
const MAX_PREVIEW_LINES = 10;
const LARGE_FILE_SIZE = 1024 * 1024; // 1MB
const MAX_PREVIEW_SIZE = 100 * 1024; // 100KB

// Cache for previewed files to improve performance
const filePreviewCache = new Map();
const CACHE_TTL = 60000; // 1 minute cache TTL

// Memoized components for file preview
const TextPreviewLine = memo(({ line }) => (
  <Text wrap="truncate">{line}</Text>
));

const FileInfoItem = memo(({ label, value }) => (
  <Box width="100%">
    <Text wrap="truncate">{label}: <Text bold>{value}</Text></Text>
  </Box>
));

const FilePreview = ({
  selectedFile,
  previewScrollOffset,
  setPreviewScrollOffset,
  width = 40,
  maxPreviewLines = MAX_PREVIEW_LINES
}) => {
  const [fileContent, setFileContent] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalLines, setTotalLines] = useState(0);

  // Async function to load file content
  const loadFileContent = useCallback(async (file) => {
    if (!file || file.isDirectory) return;

    try {
      setIsLoading(true);
      setError(null);

      // Check cache first
      const cacheKey = file.path;
      const cachedData = filePreviewCache.get(cacheKey);
      if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
        setFileContent(cachedData.content);
        setTotalLines(cachedData.totalLines);
        setFileInfo(cachedData.info);
        return;
      }

      // Get mime type
      const mimeType = mime.lookup(file.path) || '';

      // Set basic file info
      const info = {
        type: mimeType || 'Unknown',
        size: filesize(file.size),
        modified: file.mtime.toLocaleString(),
        path: file.path
      };

      setFileInfo(info);

      // Check if it's a text file and not too large
      const isText = mimeType.startsWith('text/') ||
        ['application/json', 'application/javascript', 'application/xml'].includes(mimeType);

      if (isText) {
        // For large text files, read a portion
        if (file.size > LARGE_FILE_SIZE) {
          // Open file handle for partial reading
          const fileHandle = await fs.open(file.path, 'r');
          try {
            const buffer = Buffer.alloc(MAX_PREVIEW_SIZE);
            const { bytesRead } = await fileHandle.read(buffer, 0, MAX_PREVIEW_SIZE, 0);
            const partialContent = buffer.slice(0, bytesRead).toString('utf-8');

            // Add indication that file was truncated
            const content = partialContent +
              (bytesRead < file.size ? '\n\n[File truncated - too large to display completely]' : '');

            setFileContent(content);

            // Count lines
            const lineCount = content.split('\n').length;
            setTotalLines(lineCount);

            // Cache the result
            filePreviewCache.set(cacheKey, {
              content,
              totalLines: lineCount,
              info,
              timestamp: Date.now()
            });
          } finally {
            await fileHandle.close();
          }
        } else {
          // For smaller files, read the entire content
          const content = await fs.readFile(file.path, 'utf-8');
          setFileContent(content);

          // Count lines
          const lineCount = content.split('\n').length;
          setTotalLines(lineCount);

          // Cache the result
          filePreviewCache.set(cacheKey, {
            content,
            totalLines: lineCount,
            info,
            timestamp: Date.now()
          });
        }
      } else {
        // For non-text files, just set file info
        setFileContent(null);
        setTotalLines(0);

        // Cache basic info for non-text files too
        filePreviewCache.set(cacheKey, {
          content: null,
          totalLines: 0,
          info,
          timestamp: Date.now()
        });
      }

    } catch (error) {
      setError(`Error reading file: ${error.message}`);
      setFileContent(null);
      setTotalLines(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load file content when selected file changes
  useEffect(() => {
    if (selectedFile && !selectedFile.isDirectory) {
      loadFileContent(selectedFile);
    } else {
      setFileContent(null);
      setFileInfo(null);
      setError(null);
      setTotalLines(0);
    }

    // Reset scroll position when changing files
    setPreviewScrollOffset(0);
  }, [selectedFile, loadFileContent, setPreviewScrollOffset]);

  // Handle preview scrolling
  useInput((input, key) => {
    if (!selectedFile || selectedFile.isDirectory || !fileContent) return;

    try {
      if (key.ctrl && key.upArrow) {
        // Scroll preview up
        setPreviewScrollOffset(Math.max(0, previewScrollOffset - 1));
      } else if (key.ctrl && key.downArrow) {
        // Scroll preview down
        setPreviewScrollOffset(Math.min(
          Math.max(0, totalLines - maxPreviewLines),
          previewScrollOffset + 1
        ));
      }
    } catch (err) {
      // Ignore errors during preview scrolling
    }
  }, { isActive: !!selectedFile && !selectedFile.isDirectory && !!fileContent });

  // Render the file content based on its type and state
  const renderContent = () => {
    // If no file is selected
    if (!selectedFile) {
      return (
        <Box width={width - 4}>
          <Text color="gray" wrap="truncate">Select a file to preview</Text>
        </Box>
      );
    }

    // For parent directory
    if (selectedFile === undefined) {
      return (
        <Box flexDirection="column">
          <Box width={width - 8}>
            <Text color="blue" wrap="truncate">[Parent Directory]</Text>
          </Box>
          <Box width={width - 8}>
            <Text wrap="truncate">Navigate to parent folder</Text>
          </Box>
        </Box>
      );
    }

    // For directories
    if (selectedFile.isDirectory) {
      return (
        <Box flexDirection="column">
          <Box width={width - 8}>
            <Text color="blue" wrap="truncate">[Directory]</Text>
          </Box>
          <Box width={width - 8}>
            <Text wrap="truncate">Press Enter to navigate inside</Text>
          </Box>
        </Box>
      );
    }

    // If there's an error
    if (error) {
      return (
        <Box width={width - 8}>
          <Text color="red" wrap="truncate">{error}</Text>
        </Box>
      );
    }

    // If loading
    if (isLoading) {
      return (
        <Box width={width - 8}>
          <Text color="yellow" wrap="truncate">Loading preview...</Text>
        </Box>
      );
    }

    // For text files with content
    if (fileContent) {
      // Split content into lines
      const lines = fileContent.split('\n');
      // Get visible slice based on scroll offset
      const visibleLines = lines.slice(
        previewScrollOffset,
        previewScrollOffset + maxPreviewLines
      );

      return (
        <>
          {previewScrollOffset > 0 && (
            <Box width={width - 8}>
              <Text color="yellow" wrap="truncate">↑ ({previewScrollOffset} more)</Text>
            </Box>
          )}

          {visibleLines.map((line, i) => (
            <Box key={i} width={width - 8}>
              <TextPreviewLine line={sanitizeTextForTerminal(line)} />
            </Box>
          ))}

          {previewScrollOffset + maxPreviewLines < totalLines && (
            <Box width={width - 8}>
              <Text color="yellow" wrap="truncate">
                ↓ ({totalLines - previewScrollOffset - maxPreviewLines} more)
              </Text>
            </Box>
          )}
        </>
      );
    }

    // For binary/non-text files
    if (fileInfo) {
      return (
        <Box flexDirection="column">
          <Box width={width - 8}>
            <Text bold color="yellow" wrap="truncate">
              [{fileInfo.type.split('/')[0]?.toUpperCase() || 'Binary'} File]
            </Text>
          </Box>
          <FileInfoItem label="Type" value={fileInfo.type} />
          <FileInfoItem label="Size" value={fileInfo.size} />
          <FileInfoItem label="Modified" value={fileInfo.modified} />
        </Box>
      );
    }

    // Fallback
    return (
      <Box width={width - 8}>
        <Text color="gray" wrap="truncate">No preview available</Text>
      </Box>
    );
  };

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle="single"
      borderColor="gray"
      padding={1}
      marginLeft={1}
    >
      <Box width={width - 4}>
        <Text bold color="cyan" wrap="truncate">Preview</Text>
      </Box>

      <Box width={width - 4}>
        <Text bold wrap="truncate">
          {selectedFile === undefined ?
            '..' :
            (selectedFile ?
              (selectedFile.name.length > 25 ?
                selectedFile.name.substring(0, 22) + '...' :
                selectedFile.name) :
              '')}
        </Text>
      </Box>

      <Box flexDirection="column" width={width - 4}>
        {renderContent()}
      </Box>
    </Box>
  );
};

// Export the component
export default FilePreview;
