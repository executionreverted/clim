// Updated FileList.js - Simplified for Hyperblobs flat file structure
import React, { memo } from 'react';
import { Box, Text } from 'ink';
import { filesize } from 'filesize';
import useThemeUpdate from '../../hooks/useThemeUpdate.js';
import path from 'path';

// Safely get filename without using path module
const getFilename = (filepath) => {
  if (!filepath) return 'Unknown';

  // If it's already just a filename, return it directly
  if (!filepath.includes('/')) return filepath;

  // Otherwise extract the basename
  return path.basename(filepath);
};

// Memoized file item component
const FileItem = memo(({ file, isSelected, isFocused, width, colors }) => {
  if (!file) return null;

  // Extract file properties safely with fallbacks
  const name = file.name || getFilename(file.path || '') || 'Unknown';
  const size = file.size ? filesize(file.size) : 'Unknown size';
  const sender = file.sender || 'Unknown';
  const timestamp = file.timestamp ? new Date(file.timestamp).toLocaleString() : 'Unknown date';

  // Set icon and styling
  const icon = '📄';
  const textColor = isSelected ? colors.secondaryColor : colors.textColor;

  return (
    <Box>
      <Text wrap="truncate" color={textColor}>
        {isSelected && isFocused ? '>' : ' '} {icon} {name}
        <Text color={colors.mutedTextColor}> ({size})</Text>
      </Text>
    </Box>
  );
}, (prevProps, nextProps) => {
  // Only re-render if these properties changed
  return (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.file?.path === nextProps.file?.path &&
    prevProps.file?.size === nextProps.file?.size
  );
});

// Main file list component
const FileList = ({
  files = [],
  selectedIndex = 0,
  visibleStartIndex = 0,
  maxVisibleFiles = 10,
  width = 40,
  height = 20,
  isFocused = false
}) => {
  const currentTheme = useThemeUpdate();
  const {
    primaryColor,
    secondaryColor,
    textColor,
    mutedTextColor,
    borderColor,
    activeBorderColor,
  } = currentTheme.colors;

  // Validate files array to prevent errors
  const validFiles = Array.isArray(files) ? files : [];

  // Validate indices
  const safeSelectedIndex = Math.min(
    Math.max(0, selectedIndex),
    validFiles.length > 0 ? validFiles.length - 1 : 0
  );

  const safeVisibleStartIndex = Math.min(
    Math.max(0, visibleStartIndex),
    Math.max(0, validFiles.length - maxVisibleFiles)
  );

  // Determine border color based on focus
  const boxBorderColor = isFocused ? activeBorderColor : borderColor;

  // Check if we need to show pagination indicators
  const showUpIndicator = safeVisibleStartIndex > 0;
  const showDownIndicator = safeVisibleStartIndex + maxVisibleFiles < validFiles.length;

  // Get visible files based on current scroll position
  const visibleFiles = validFiles.slice(
    safeVisibleStartIndex,
    safeVisibleStartIndex + maxVisibleFiles
  );

  return (
    <Box
      width={width}
      height={height}
      borderStyle="single"
      borderColor={boxBorderColor}
      flexDirection="column"
      padding={1}
    >
      <Box marginBottom={1}>
        <Text bold wrap="truncate">
          Files ({validFiles.length} {validFiles.length === 1 ? 'file' : 'files'})
        </Text>
      </Box>

      {validFiles.length === 0 ? (
        <Box>
          <Text color={mutedTextColor} italic>
            No files shared in this room
          </Text>
          <Box marginTop={1}>
            <Text color={mutedTextColor}>
              Press 'u' to upload a file
            </Text>
          </Box>
        </Box>
      ) : (
        <>
          {/* Up indicator */}
          {showUpIndicator && (
            <Box>
              <Text color={secondaryColor}>↑ {safeVisibleStartIndex} more file(s)</Text>
            </Box>
          )}

          {/* Visible files */}
          <Box flexDirection="column">
            {visibleFiles.map((file, index) => {
              if (!file) return null; // Skip invalid files

              const actualIndex = index + safeVisibleStartIndex;
              return (
                <FileItem
                  key={file.path || `file-${actualIndex}`}
                  file={file}
                  isSelected={actualIndex === safeSelectedIndex}
                  isFocused={isFocused}
                  width={width}
                  colors={{
                    primaryColor,
                    secondaryColor,
                    textColor,
                    mutedTextColor
                  }}
                />
              );
            })}
          </Box>

          {/* Down indicator */}
          {showDownIndicator && (
            <Box>
              <Text color={secondaryColor}>
                ↓ {validFiles.length - (safeVisibleStartIndex + maxVisibleFiles)} more file(s)
              </Text>
            </Box>
          )}
        </>
      )}

      {/* Help text */}
      <Box marginTop={1}>
        <Text color={mutedTextColor} italic>
          {isFocused ? 'Press D to download selected file' : 'Arrow keys to navigate'}
        </Text>
      </Box>
    </Box>
  );
};

export default memo(FileList);
