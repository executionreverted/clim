// source/components/RoomFiles/FileList.js - Memory optimized version

import React, { memo } from 'react';
import { Box, Text } from 'ink';
import path from 'path';
import { filesize } from 'filesize';
import useThemeUpdate from '../../hooks/useThemeUpdate.js';

// Memoized file item to avoid unnecessary rerenders
const FileItem = memo(({ file, isSelected, isFocused, width, colors }) => {
  // Extract file properties safely
  const name = file.name || path.basename(file.path) || 'Unknown';
  const size = file.size ? filesize(file.size) : 'Unknown size';
  const isDirectory = file.isDirectory;

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
    prevProps.file.path === nextProps.file.path &&
    prevProps.file.size === nextProps.file.size
  );
});

// Main component
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
    activeBorderColor
  } = currentTheme.colors;

  // Determine border color based on focus
  const boxBorderColor = isFocused ? activeBorderColor : borderColor;

  // Check if we need to show pagination indicators
  const showUpIndicator = visibleStartIndex > 0;
  const showDownIndicator = visibleStartIndex + maxVisibleFiles < files.length;

  // Get visible files based on current scroll position
  const visibleFiles = files.slice(visibleStartIndex, visibleStartIndex + maxVisibleFiles);

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
          {path.basename(currentPath) || 'Files'} ({files.length} items)
        </Text>
      </Box>

      {files.length === 0 ? (
        <Box>
          <Text color={mutedTextColor} italic>
            This folder is empty
          </Text>
        </Box>
      ) : (
        <>
          {/* Up indicator */}
          {showUpIndicator && (
            <Box>
              <Text color={secondaryColor}>↑ {visibleStartIndex} more item(s)</Text>
            </Box>
          )}

          {/* Visible files */}
          <Box flexDirection="column">
            {visibleFiles.map((file, index) => {
              const actualIndex = index + visibleStartIndex;
              return (
                <FileItem
                  key={file.path || actualIndex}
                  file={file}
                  isSelected={actualIndex === selectedIndex}
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
                ↓ {files.length - (visibleStartIndex + maxVisibleFiles)} more item(s)
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
