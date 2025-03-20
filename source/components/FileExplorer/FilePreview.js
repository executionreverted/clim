// components/FileExplorer/FilePreview.js
import React from 'react';
import { Box, Text, useInput } from 'ink';
import fs from 'fs';
import mime from 'mime-types';
import { filesize } from 'filesize';
import { sanitizeTextForTerminal, isTextFile } from './utils.js';

const FilePreview = ({
  selectedFile,
  previewScrollOffset,
  setPreviewScrollOffset,
  width,
  maxPreviewLines
}) => {
  // Handle preview scrolling
  useInput((input, key) => {
    if (!selectedFile || selectedFile.isDirectory) return;

    const mimeType = mime.lookup(selectedFile.path) || '';
    const isText = isTextFile(mimeType);

    if (!isText) return;

    try {
      const content = fs.readFileSync(selectedFile.path, 'utf-8');
      const totalLines = content.split('\n').length;

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
  }, { isActive: !!selectedFile && !selectedFile.isDirectory });

  const renderTextPreview = (file) => {
    try {
      // Use available width minus some padding for safety
      const PREVIEW_MAX_WIDTH = Math.max(20, width - 8);

      let content;
      try {
        content = fs.readFileSync(file.path, 'utf-8');
      } catch (err) {
        return (
          <Box width={PREVIEW_MAX_WIDTH}>
            <Text color="red" wrap="truncate">Error reading file</Text>
          </Box>
        );
      }

      // Split into lines and handle line count
      const lines = content.split('\n');
      const totalLines = lines.length;

      // Get visible slice based on scroll offset
      const visibleLines = lines.slice(
        previewScrollOffset,
        previewScrollOffset + maxPreviewLines
      );

      return (
        <>
          {previewScrollOffset > 0 && (
            <Box width={PREVIEW_MAX_WIDTH}>
              <Text color="yellow" wrap="truncate">↑ ({previewScrollOffset} more)</Text>
            </Box>
          )}

          {visibleLines.map((line, i) => {
            // Sanitize and truncate each line
            const sanitizedLine = sanitizeTextForTerminal(line);
            const displayStr = sanitizedLine.length > PREVIEW_MAX_WIDTH - 3
              ? sanitizedLine.substring(0, PREVIEW_MAX_WIDTH - 3) + '...'
              : sanitizedLine;

            return (
              <Box key={i} width={PREVIEW_MAX_WIDTH}>
                <Text wrap="truncate">{displayStr}</Text>
              </Box>
            );
          })}

          {previewScrollOffset + maxPreviewLines < totalLines && (
            <Box width={PREVIEW_MAX_WIDTH}>
              <Text color="yellow" wrap="truncate">↓ ({totalLines - previewScrollOffset - maxPreviewLines} more)</Text>
            </Box>
          )}
        </>
      );
    } catch (err) {
      return (
        <Box width={width - 8}>
          <Text color="red" wrap="truncate">Error: {err.message}</Text>
        </Box>
      );
    }
  };

  const renderImagePreview = (file) => {
    return (
      <Box flexDirection="column">
        <Box width={width - 8}>
          <Text bold color="magenta" wrap="truncate">[Image File]</Text>
        </Box>
        <Box width={width - 8}>
          <Text wrap="truncate">Type: {mime.lookup(file.path) || 'Unknown'}</Text>
        </Box>
        <Box width={width - 8}>
          <Text wrap="truncate">Size: {filesize(file.size)}</Text>
        </Box>
        <Box width={width - 8}>
          <Text wrap="truncate">Modified: {file.mtime.toLocaleString()}</Text>
        </Box>
      </Box>
    );
  };

  const renderBinaryPreview = (file) => {
    return (
      <Box flexDirection="column">
        <Box width={width - 8}>
          <Text bold color="yellow" wrap="truncate">[Binary File]</Text>
        </Box>
        <Box width={width - 8}>
          <Text wrap="truncate">Type: {mime.lookup(file.path) || 'Unknown'}</Text>
        </Box>
        <Box width={width - 8}>
          <Text wrap="truncate">Size: {filesize(file.size)}</Text>
        </Box>
        <Box width={width - 8}>
          <Text wrap="truncate">Modified: {file.mtime.toLocaleString()}</Text>
        </Box>
      </Box>
    );
  };

  const renderDirectoryPreview = (file) => {
    try {
      const itemCount = fs.readdirSync(file.path).length;
      return (
        <Box flexDirection="column">
          <Box width={width - 8}>
            <Text color="blue" wrap="truncate">[Directory]</Text>
          </Box>
          <Box width={width - 8}>
            <Text wrap="truncate">Contains {itemCount} items</Text>
          </Box>
          <Box width={width - 8}>
            <Text wrap="truncate">Modified: {file.mtime.toLocaleString()}</Text>
          </Box>
        </Box>
      );
    } catch (err) {
      return (
        <Box width={width - 8}>
          <Text color="red" wrap="truncate">Error reading directory</Text>
        </Box>
      );
    }
  };

  const renderFileContent = (file) => {
    if (!file) {
      return (
        <Box width={width - 8}>
          <Text color="gray" wrap="truncate">Select a file to preview</Text>
        </Box>
      );
    }

    if (file.isDirectory) {
      return renderDirectoryPreview(file);
    }

    try {
      const mimeType = mime.lookup(file.path) || '';
      const isText = isTextFile(mimeType);

      if (isText) {
        return renderTextPreview(file);
      } else if (mimeType.startsWith('image/')) {
        return renderImagePreview(file);
      } else {
        return renderBinaryPreview(file);
      }
    } catch (err) {
      return (
        <Box width={width - 8}>
          <Text color="red" wrap="truncate">Error: {err.message}</Text>
        </Box>
      );
    }
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

      {selectedFile && (
        <Box width={width - 4}>
          <Text bold wrap="truncate">
            {selectedFile.name.length > width - 10
              ? selectedFile.name.substring(0, width - 13) + '...'
              : selectedFile.name}
          </Text>
        </Box>
      )}

      <Box flexDirection="column" width={width - 4}>
        {renderFileContent(selectedFile)}
      </Box>
    </Box>
  );
};

export default FilePreview;
