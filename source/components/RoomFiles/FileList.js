// Updated FileList.js - Simplified for Hyperblobs flat file structure
import React, { memo } from 'react';
import { Box, Text } from 'ink';
import { filesize } from 'filesize';
import useThemeUpdate from '../../hooks/useThemeUpdate.js';
import path from 'path';


function shortenFileName(fileName, maxLength = 12) {
  if (fileName.length <= maxLength) return fileName;

  const extension = path.extname(fileName);
  const baseName = path.basename(fileName, extension);

  if (baseName.length + extension.length <= maxLength) {
    return fileName;
  }

  const prefixLength = Math.floor((maxLength - 4) / 2);
  const suffixLength = maxLength - prefixLength - 3;

  return `${baseName.slice(0, prefixLength)}...${baseName.slice(-suffixLength)}${extension}`;
}

// Memoized file item component
// Replace the FileItem component in source/components/RoomFiles/FileList.js
const FileItem = memo(({ file, isSelected, isFocused, width, colors, downloadStatus }) => {
  const name = file.name || path.basename(file.path || '') || 'Unknown';
  const downloadIcon = downloadStatus?.downloaded ? '✓' : '↓';
  const downloadColor = downloadStatus?.downloaded ? colors.successColor : colors.warningColor;

  return (
    <Box gap={1} width={width} overflow="hidden">
      <Text flexGrow={1} width={width - 4} wrap="truncate" color={isSelected ? colors.secondaryColor : colors.primaryColor}>
        {isSelected && isFocused ? '> ' : ' '}
        {shortenFileName(name)}
      </Text>
      <Text bold color={downloadColor}>
        {downloadIcon}
      </Text>
    </Box>
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
  isFocused = false,
  downloadedFiles = {}
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
              Press 's' in chat room to upload files
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
          <Box overflow={"hidden"} flexDirection="column">
            {visibleFiles.map((file, index) => {
              if (!file) return null; // Skip invalid files

              const actualIndex = index + safeVisibleStartIndex;
              return (
                <FileItem
                  key={file.path + file.timestamp || `file-${actualIndex}`}
                  file={file}
                  isSelected={actualIndex === safeSelectedIndex}
                  isFocused={isFocused}
                  width={width}
                  downloadStatus={downloadedFiles[file.name]}
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
