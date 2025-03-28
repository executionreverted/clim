// Updated FileList.js - Simplified for Hyperblobs flat file structure
import React, { memo } from 'react';
import { Box, Text } from 'ink';
import { filesize } from 'filesize';
import useThemeUpdate from '../../hooks/useThemeUpdate.js';
import path from 'path';
import { writeFileSync } from 'fs';


// Memoized file item component
// Replace the FileItem component in source/components/RoomFiles/FileList.js
const FileItem = memo(({ file, isSelected, isFocused, width, colors, isDownloaded }) => {
  if (!file) return null;

  // Extract file properties safely with fallbacks
  const name = file.name || path.basename(file.path || '') || 'Unknown';

  // Calculate maximum name length based on available width
  const maxNameLength = Math.min(10, Math.floor(width * 0.5)); // 50% of available width
  const displayName = name.length > maxNameLength
    ? name.substring(0, maxNameLength - 3) + '...'
    : name;

  // Set icon based on file type
  let icon = '📄';
  if (name.toLowerCase().endsWith('.jpg') || name.toLowerCase().endsWith('.png') || name.toLowerCase().endsWith('.gif')) {
    icon = '🖼️';
  } else if (name.toLowerCase().endsWith('.pdf')) {
    icon = '📑';
  } else if (name.toLowerCase().endsWith('.mp3') || name.toLowerCase().endsWith('.wav')) {
    icon = '🎵';
  } else if (name.toLowerCase().endsWith('.mp4') || name.toLowerCase().endsWith('.mov')) {
    icon = '🎬';
  } else if (name.toLowerCase().endsWith('.zip') || name.toLowerCase().endsWith('.tar')) {
    icon = '📦';
  }

  return (
    <Box width={width} overflow="hidden">
      <Text width={width - 2} wrap="truncate" color={isSelected ? colors.secondaryColor : colors.textColor}>
        {isSelected && isFocused ? '>' : ' '}
        {icon}
        {displayName}
        {
          isDownloaded ? 't' : 'f'
        }
      </Text>
    </Box>
  );
}, (prevProps, nextProps) => {
  // Memoization logic to prevent unnecessary re-renders
  return (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.file?.name === nextProps.file?.name &&
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
                  isDownloaded={downloadedFiles[file.name]}
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
