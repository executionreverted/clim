// Improved FileList component with safer path handling
import React, { memo } from 'react';
import { Box, Text } from 'ink';
import { filesize } from 'filesize';
import useThemeUpdate from '../../hooks/useThemeUpdate.js';

// Helper function to safely get basename without using path module
const getBasename = (filepath) => {
  if (!filepath) return 'Unknown';
  const parts = filepath.split('/');
  return parts[parts.length - 1] || parts[parts.length - 2] || 'Unknown';
};

// Memoized file item with safer path handling
const FileItem = memo(({ file, isSelected, isFocused, width, colors }) => {
  if (!file) return null;

  // Extract file properties safely with fallbacks
  const name = file.name || getBasename(file.path || '') || 'Unknown';
  const size = file.size ? filesize(file.size) : 'Unknown size';
  const isDirectory = !!file.isDirectory;

  // Determine icon and color based on file type
  const icon = isDirectory ? '📁' : '📄';
  const textColor = isSelected ? colors.secondaryColor : colors.textColor;

  return (
    <Box>
      <Text wrap="truncate" color={textColor}>
        {isSelected && isFocused ? '>' : ' '} {icon} {name}
        {!isDirectory && (
          <Text color={colors.mutedTextColor}> ({size})</Text>
        )}
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

// Improved FileList with better error handling
const FileList = ({
  files = [],
  selectedIndex = 0,
  visibleStartIndex = 0,
  maxVisibleFiles = 10,
  width = 40,
  height = 20,
  currentPath = '/',
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

  // Format the current path for display
  const displayPath = getBasename(currentPath) || 'Files';

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
          {displayPath} ({validFiles.length} {validFiles.length === 1 ? 'item' : 'items'})
        </Text>
      </Box>

      {validFiles.length === 0 ? (
        <Box>
          <Text color={mutedTextColor} italic>
            {currentPath === '/' ? 'Root directory is empty' : 'This folder is empty'}
          </Text>
        </Box>
      ) : (
        <>
          {/* Up indicator */}
          {showUpIndicator && (
            <Box>
              <Text color={secondaryColor}>↑ {safeVisibleStartIndex} more item(s)</Text>
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
                ↓ {validFiles.length - (safeVisibleStartIndex + maxVisibleFiles)} more item(s)
              </Text>
            </Box>
          )}
        </>
      )}

      {/* Show path info */}
      <Box marginTop={1}>
        <Text color={mutedTextColor} wrap="truncate">
          Path: {currentPath}
        </Text>
      </Box>
    </Box>
  );
};

export default memo(FileList);
