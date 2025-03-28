// Updated FilePreview.js - Optimized for Hyperblobs with better content handling
import React, { useState, useEffect, memo } from 'react';
import { Box, Text } from 'ink';
import { filesize } from 'filesize';
import path from 'path';
import mime from 'mime-types';
import { sanitizeTextForTerminal } from '../FileExplorer/utils.js';
import useThemeUpdate from '../../hooks/useThemeUpdate.js';
import { safelyReadFile, safeString } from '../../utils/memory-management.js';

// Constants for file preview limits
const MAX_PREVIEW_SIZE = 100 * 1024; // 100KB max preview
const MAX_PREVIEW_LINES = 100;

// Memoized component for text preview
const TextPreview = memo(({ content, scrollOffset, maxLines, width, colors }) => {
  if (!content) return null;

  // Safe way to count lines without loading too much in memory
  let lineCount = 0;
  let i = 0;
  while (i < content.length) {
    if (content[i] === '\n') lineCount++;
    i++;
  }
  lineCount++; // Account for last line without newline

  // Apply scrolling with boundary checks
  const startLine = Math.min(scrollOffset, Math.max(0, lineCount - maxLines));

  // Create an array to hold the visible lines
  let visibleLines = [];

  // More memory-efficient approach to extract only the lines we need
  let currentLine = 0;
  let lineStart = 0;
  i = 0;

  while (i < content.length && visibleLines.length < maxLines) {
    if (content[i] === '\n' || i === content.length - 1) {
      // We found the end of a line
      if (currentLine >= startLine) {
        // Only process lines we'll actually display
        const line = content.substring(lineStart, i === content.length - 1 ? i + 1 : i);
        visibleLines.push(line);
      }
      currentLine++;
      lineStart = i + 1;

      // Exit early if we've gone past what we need
      if (currentLine > startLine + maxLines) break;
    }
    i++;
  }

  return (
    <Box flexDirection="column">
      {/* Show scroll indicator if there are lines above */}
      {startLine > 0 && (
        <Box>
          <Text color={colors.warningColor}>↑ {startLine} more lines above</Text>
        </Box>
      )}

      {/* Show visible lines */}
      {visibleLines.map((line, index) => (
        <Box key={`line-${index}`} width={width - 4}>
          <Text wrap="truncate">
            {sanitizeTextForTerminal(line)}
          </Text>
        </Box>
      ))}

      {/* Show scroll indicator if there are lines below */}
      {lineCount > startLine + maxLines && (
        <Box>
          <Text color={colors.warningColor}>
            ↓ {lineCount - (startLine + maxLines)} more lines below
          </Text>
        </Box>
      )}
    </Box>
  );
});

// Memoized component for image preview
const ImagePreview = memo(({ file, colors }) => {
  return (
    <Box flexDirection="column" padding={1}>
      <Text color={colors.secondaryColor} bold>Image Preview</Text>
      <Box marginY={1}>
        <Text>🖼️  Image file: {file.name || path.basename(file.path || '')}</Text>
      </Box>
      <Text italic color={colors.mutedTextColor}>
        (Image preview not available in terminal)
      </Text>
    </Box>
  );
});

// Memoized component for audio preview
const AudioPreview = memo(({ file, colors }) => {
  return (
    <Box flexDirection="column" padding={1}>
      <Text color={colors.secondaryColor} bold>Audio File</Text>
      <Box marginY={1}>
        <Text>🎵  Audio: {file.name || path.basename(file.path || '')}</Text>
      </Box>
      <Text italic color={colors.mutedTextColor}>
        (Audio preview not available in terminal)
      </Text>
    </Box>
  );
});

// Memoized component for video preview
const VideoPreview = memo(({ file, colors }) => {
  return (
    <Box flexDirection="column" padding={1}>
      <Text color={colors.secondaryColor} bold>Video File</Text>
      <Box marginY={1}>
        <Text>🎬  Video: {file.name || path.basename(file.path || '')}</Text>
      </Box>
      <Text italic color={colors.mutedTextColor}>
        (Video preview not available in terminal)
      </Text>
    </Box>
  );
});

// Memoized component for file metadata display
const FileMetadata = memo(({ file, colors }) => {
  const fileName = file.name || path.basename(file.path || '');
  const extension = path.extname(fileName).toLowerCase();
  const mimeType = mime.lookup(fileName) || 'Unknown type';
  const fileSize = file.size ? filesize(file.size) : 'Unknown size';
  const created = file.timestamp ? new Date(file.timestamp).toLocaleString() : 'Unknown';
  const sender = file.sender || 'Unknown';

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold color={colors.secondaryColor}>File Information</Text>

      <Box marginTop={1}>
        <Text>Type: <Text color={colors.secondaryColor}>{mimeType}</Text></Text>
      </Box>

      <Box>
        <Text>Size: <Text color={colors.secondaryColor}>{fileSize}</Text></Text>
      </Box>

      {extension && (
        <Box>
          <Text>Extension: <Text color={colors.secondaryColor}>{extension}</Text></Text>
        </Box>
      )}

      <Box>
        <Text>Shared by: <Text color={colors.secondaryColor}>{sender}</Text></Text>
      </Box>

      <Box>
        <Text>Created: <Text color={colors.secondaryColor}>{created}</Text></Text>
      </Box>

      <Box marginTop={1}>
        <Text>Path: <Text color={colors.mutedTextColor}>{file.path || 'Unknown'}</Text></Text>
      </Box>

      {file.blobId && (
        <Box>
          <Text>Blob ID: <Text color={colors.mutedTextColor}>{typeof file.blobId === 'object' ? 'Complex blob reference' : file.blobId}</Text></Text>
        </Box>
      )}
    </Box>
  );
});

// Main file preview component
const FilePreview = ({
  file,
  width = 50,
  height = 20,
  scrollOffset = 0,
  activeRoomId,
  downloadFile
}) => {
  const currentTheme = useThemeUpdate();
  const {
    primaryColor,
    secondaryColor,
    textColor,
    mutedTextColor,
    borderColor,
    warningColor,
    errorColor,
    successColor
  } = currentTheme.colors;

  const [previewContent, setPreviewContent] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [memoryWarning, setMemoryWarning] = useState(false);

  // Determine file type for preview
  const getFileType = () => {
    if (!file) return 'none';

    // Hyperblobs doesn't support directories
    if (file.isDirectory) return 'directory';

    const fileName = file.name || path.basename(file.path || '');
    const extension = path.extname(fileName).toLowerCase();
    const mimeType = mime.lookup(fileName) || '';

    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('video/')) return 'video';

    // Text file types
    const textExtensions = [
      '.txt', '.md', '.js', '.py', '.html', '.css', '.json',
      '.xml', '.yaml', '.yml', '.csv', '.log', '.sh', '.c',
      '.cpp', '.h', '.java', '.jsx', '.ts', '.tsx'
    ];

    if (textExtensions.includes(extension) ||
      mimeType.startsWith('text/') ||
      mimeType === 'application/json' ||
      mimeType === 'application/xml') {
      return 'text';
    }

    return 'binary';
  };

  // Load preview content for text files
  useEffect(() => {
    // Clean up previous content to free memory
    setPreviewContent(null);

    const fileType = getFileType();

    // Only load preview content for text files
    if (fileType === 'text' && file && activeRoomId) {
      setIsLoading(true);
      setError(null);
      setMemoryWarning(false);

      // Use safer memory-managed file reading
      const loadTextContent = async () => {
        try {
          // Load file content safely using the downloadFile function
          const data = await downloadFile(activeRoomId, file.path || file);

          if (!data) {
            setError('Could not load file content');
            setIsLoading(false);
            return;
          }

          // Convert Buffer to string, but only process a safe amount
          let content;
          if (Buffer.isBuffer(data)) {
            // Only load the first MAX_PREVIEW_SIZE bytes to prevent memory issues
            const previewSize = Math.min(data.length, MAX_PREVIEW_SIZE);
            content = data.slice(0, previewSize).toString('utf-8');

            if (data.length > MAX_PREVIEW_SIZE) {
              content += '\n\n[File truncated - too large to display completely]';
              setMemoryWarning(true);
            }
          } else if (typeof data === 'string') {
            content = data.substring(0, MAX_PREVIEW_SIZE);

            if (data.length > MAX_PREVIEW_SIZE) {
              content += '\n\n[File truncated - too large to display completely]';
              setMemoryWarning(true);
            }
          } else {
            throw new Error('Unexpected data format');
          }

          // Set the preview content
          setPreviewContent(safeString.truncate(content, MAX_PREVIEW_SIZE));
          setError(null);
          setIsLoading(false);
        } catch (err) {
          setError(`Error loading preview: ${err.message}`);
          setIsLoading(false);
        }
      };

      loadTextContent();
    } else {
      // Reset preview content for non-text files
      setPreviewContent(null);
      setError(null);
    }
  }, [file, activeRoomId, downloadFile]);

  // Calculate available preview height (accounting for metadata)
  const contentHeight = height - 8; // Reserve space for borders, title, metadata

  // Render file preview based on file type
  const renderPreview = () => {
    if (!file) {
      return (
        <Box flexDirection="column" padding={1}>
          <Text color={mutedTextColor} italic>
            Select a file to view details
          </Text>
        </Box>
      );
    }

    if (isLoading) {
      return (
        <Box flexDirection="column" padding={1}>
          <Text color={warningColor}>Loading preview...</Text>
        </Box>
      );
    }

    if (error) {
      return (
        <Box flexDirection="column" padding={1}>
          <Text color={errorColor}>{error}</Text>
        </Box>
      );
    }

    const fileType = getFileType();

    switch (fileType) {
      case 'image':
        return (
          <ImagePreview
            file={file}
            colors={currentTheme.colors}
          />
        );

      case 'audio':
        return (
          <AudioPreview
            file={file}
            colors={currentTheme.colors}
          />
        );

      case 'video':
        return (
          <VideoPreview
            file={file}
            colors={currentTheme.colors}
          />
        );

      case 'text':
        if (!previewContent) {
          return (
            <Box flexDirection="column" padding={1}>
              <Text color={warningColor}>Loading text preview...</Text>
            </Box>
          );
        }

        return (
          <>
            <TextPreview
              content={previewContent}
              scrollOffset={scrollOffset}
              maxLines={Math.max(3, contentHeight - 5)}
              width={width}
              colors={currentTheme.colors}
            />
            {memoryWarning && (
              <Box marginTop={1}>
                <Text color={warningColor} italic>
                  File is large. Only showing first part.
                </Text>
              </Box>
            )}
          </>
        );

      case 'binary':
      default:
        return (
          <Box flexDirection="column" padding={1}>
            <Text color={secondaryColor} bold>Binary File</Text>
            <Box marginY={1}>
              <Text>
                File: {file.name || path.basename(file.path || '')}
              </Text>
            </Box>
            <Text italic color={mutedTextColor}>
              (Preview not available for this file type)
            </Text>
          </Box>
        );
    }
  };

  return (
    <Box
      width={width}
      height={height}
      borderStyle="single"
      borderColor={borderColor}
      flexDirection="column"
      padding={1}
    >
      <Box marginBottom={1}>
        <Text bold color={secondaryColor}>Preview</Text>
      </Box>

      {file && (
        <Box marginBottom={1}>
          <Text bold wrap="truncate">
            {file.name || path.basename(file.path || '') || 'Unknown'}
          </Text>
        </Box>
      )}

      {/* Main preview content */}
      <Box flexDirection="column" flexGrow={1}>
        {renderPreview()}
      </Box>

      {/* Metadata section at bottom */}
      {file && <FileMetadata file={file} colors={currentTheme.colors} />}

      {/* Help text for scrolling text files */}
      {file && getFileType() === 'text' && previewContent && (
        <Box marginTop={1}>
          <Text color={mutedTextColor} italic>
            Use J/K keys to scroll preview
          </Text>
        </Box>
      )}
    </Box>
  );
};


export default FilePreview
