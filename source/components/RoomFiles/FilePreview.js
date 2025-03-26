// source/components/RoomFiles/FilePreview.js
import React, { useState, useEffect, memo } from 'react';
import { Box, Text } from 'ink';
import { filesize } from 'filesize';
import path from 'path';
import mime from 'mime-types';
import { sanitizeTextForTerminal } from '../FileExplorer/utils.js';
import useThemeUpdate from '../../hooks/useThemeUpdate.js';

// Constants for file preview limits
const MAX_PREVIEW_SIZE = 100 * 1024; // 100KB max preview
const MAX_PREVIEW_LINES = 100;

// Preview text content based on file type
const TextPreview = memo(({ content, scrollOffset, maxLines, width, colors }) => {
  if (!content) return null;

  // Calculate line count safely without loading all lines into memory
  const lineCount = content.split('\n').length;

  // Apply scrolling with boundary checks
  const startLine = Math.min(scrollOffset, Math.max(0, lineCount - maxLines));

  // Only process the lines we're actually going to display
  // This reduces memory usage significantly
  const visibleLines = content
    .split('\n')
    .slice(startLine, startLine + maxLines);

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

// Image preview placeholder
const ImagePreview = memo(({ file, colors }) => {
  return (
    <Box flexDirection="column" padding={1}>
      <Text color={colors.secondaryColor} bold>Image Preview</Text>
      <Box marginY={1}>
        <Text>🖼️  Image file: {path.basename(file.path)}</Text>
      </Box>
      <Text italic color={colors.mutedTextColor}>
        (Image preview not available in terminal)
      </Text>
    </Box>
  );
});

// Audio file preview
const AudioPreview = memo(({ file, colors }) => {
  return (
    <Box flexDirection="column" padding={1}>
      <Text color={colors.secondaryColor} bold>Audio File</Text>
      <Box marginY={1}>
        <Text>🎵  Audio: {path.basename(file.path)}</Text>
      </Box>
      <Text italic color={colors.mutedTextColor}>
        (Audio preview not available in terminal)
      </Text>
    </Box>
  );
});

// Video file preview
const VideoPreview = memo(({ file, colors }) => {
  return (
    <Box flexDirection="column" padding={1}>
      <Text color={colors.secondaryColor} bold>Video File</Text>
      <Box marginY={1}>
        <Text>🎬  Video: {path.basename(file.path)}</Text>
      </Box>
      <Text italic color={colors.mutedTextColor}>
        (Video preview not available in terminal)
      </Text>
    </Box>
  );
});

// Directory preview
const DirectoryPreview = memo(({ file, colors }) => {
  return (
    <Box flexDirection="column" padding={1}>
      <Text color={colors.secondaryColor} bold>Directory</Text>
      <Box marginY={1}>
        <Text>📁  {path.basename(file.path) || 'Root directory'}</Text>
      </Box>
      <Text color={colors.primaryColor}>Press Enter to navigate into this folder</Text>
    </Box>
  );
});

// File metadata display
const FileMetadata = memo(({ file, colors }) => {
  const fileName = file.name || path.basename(file.path);
  const extension = path.extname(fileName).toLowerCase();
  const mimeType = mime.lookup(fileName) || 'Unknown type';
  const fileSize = file.size ? filesize(file.size) : 'Unknown size';
  const created = file.createdAt ? new Date(file.createdAt).toLocaleString() : 'Unknown';

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
        <Text>Created: <Text color={colors.secondaryColor}>{created}</Text></Text>
      </Box>

      <Box marginTop={1}>
        <Text>Path: <Text color={colors.mutedTextColor}>{file.path}</Text></Text>
      </Box>
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

  // Determine file type for preview
  const getFileType = () => {
    if (!file) return 'none';
    if (file.isDirectory) return 'directory';

    const fileName = file.name || path.basename(file.path);
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
    const fileType = getFileType();
    let abortController = new AbortController();

    // Only load preview content for text files
    if (fileType === 'text' && file && activeRoomId) {
      setIsLoading(true);
      setError(null);

      // Define a maximum chunk size to load at once
      const CHUNK_SIZE = 50 * 1024; // 50KB chunks

      // Fetch the file content with chunking
      const loadTextContent = async () => {
        try {
          const data = await downloadFile(activeRoomId, file.path);

          if (!data) {
            setError('Could not load file content');
            setIsLoading(false);
            return;
          }

          // Convert Buffer to string, but only process a safe amount
          let content;
          if (Buffer.isBuffer(data)) {
            // Only load the first MAX_PREVIEW_SIZE bytes to prevent memory issues
            content = data.slice(0, MAX_PREVIEW_SIZE).toString('utf-8');
          } else if (typeof data === 'string') {
            content = data.substring(0, MAX_PREVIEW_SIZE);
          } else {
            throw new Error('Unexpected data format');
          }

          // Add truncation notice if needed
          if (data.length > MAX_PREVIEW_SIZE) {
            content += '\n\n[File truncated - too large to display completely]';
          }

          if (!abortController.signal.aborted) {
            setPreviewContent(content);
            setError(null);
            setIsLoading(false);
          }
        } catch (err) {
          if (!abortController.signal.aborted) {
            setError(`Error loading preview: ${err.message}`);
            setIsLoading(false);
          }
        }
      };

      loadTextContent();
    } else {
      // Reset preview content for non-text files
      setPreviewContent(null);
      setError(null);
    }

    return () => {
      // Clean up and abort any pending requests when component unmounts or file changes
      abortController.abort();
      // Clear large content from memory
      setPreviewContent(null);
    };
  }, [file, activeRoomId, downloadFile]);  // Calculate available preview height (accounting for metadata)
  const contentHeight = height - 8; // Reserve space for borders, title, metadata

  // Render file preview based on file type
  const renderPreview = () => {
    if (!file) {
      return (
        <Box flexDirection="column" padding={1}>
          <Text color={mutedTextColor} italic>
            Select a file or folder to view details
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
      case 'directory':
        return (
          <DirectoryPreview
            file={file}
            colors={currentTheme.colors}
          />
        );

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
        return (
          <TextPreview
            content={previewContent}
            scrollOffset={scrollOffset}
            maxLines={Math.max(3, contentHeight - 5)}
            width={width}
            colors={currentTheme.colors}
          />
        );

      case 'binary':
      default:
        return (
          <Box flexDirection="column" padding={1}>
            <Text color={secondaryColor} bold>Binary File</Text>
            <Box marginY={1}>
              <Text>
                File: {file.name || path.basename(file.path)}
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
            {file.name || path.basename(file.path) || 'Unknown'}
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

export default FilePreview;
