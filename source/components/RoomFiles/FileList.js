// Updated FileList.js - Simplified for Hyperblobs flat file structure
import React, { memo } from 'react';
import { Box, Text } from 'ink';
import { filesize } from 'filesize';
import useThemeUpdate from '../../hooks/useThemeUpdate.js';
import path from 'path';
import { writeFileSync } from 'fs';


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

const getFileStatus = (file, downloadStatus, downloadProgress) => {
  // Check if file is currently downloading
  if (downloadProgress && downloadProgress[file.path]?.status === 'downloading') {
    return { status: 'downloading', icon: '↓', color: 'yellow' };
  }

  // Check if download failed
  if (downloadProgress && downloadProgress[file.path]?.status === 'failed') {
    return { status: 'failed', icon: '✗', color: 'red' };
  }

  // Check if file is already downloaded
  if (downloadStatus?.downloaded) {
    return { status: 'downloaded', icon: '✓', color: 'green' };
  }

  // Check if file is shared by current user
  if (file.coreKey === identity?.publicKey) {
    return { status: 'owned', icon: '⚡', color: 'blue' };
  }

  // Default - available for download
  return { status: 'available', icon: '↓', color: 'gray' };
};

const getFileTypeIcon = (fileName) => {
  const ext = path.extname(fileName).toLowerCase();

  // Images
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) {
    return '🖼️';
  }

  // Documents
  if (['.pdf', '.doc', '.docx', '.txt', '.md'].includes(ext)) {
    return '📄';
  }

  // Media
  if (['.mp3', '.wav', '.ogg', '.flac', '.m4a'].includes(ext)) {
    return '🎵';
  }
  if (['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext)) {
    return '🎬';
  }

  // Archives
  if (['.zip', '.rar', '.tar', '.gz', '.7z', '.dmg'].includes(ext)) {
    return '📦';
  }

  // Code
  if (['.js', '.py', '.cpp', '.html', '.css', '.jsx', '.ts'].includes(ext)) {
    return '📝';
  }

  // Default
  return '📎';
};

// Memoized file item component
// Replace the FileItem component in source/components/RoomFiles/FileList.js
const FileItem = memo(({ file, isSelected, isFocused, width, colors, downloadStatus, downloadProgress }) => {
  const name = file.name || path.basename(file.path || '') || 'Unknown';

  // Determine status and display
  let statusIcon, statusColor;
  let progressBar = null;
  if (downloadProgress && downloadProgress[file.name]) {
    const progress = downloadProgress[file.name];

    if (progress.status === 'downloading') {
      statusIcon = '↓';
      statusColor = colors.warningColor;

      // Create simple ASCII progress bar
      const percent = progress.percent;
      const barWidth = 10;
      const filledChars = Math.floor((percent / 100) * barWidth);
      const emptyChars = barWidth - filledChars;

      progressBar = (
        <Box gapY={1} flexDirection={"column"}>
          <Box>
            <Text color={colors.successColor}>{'█'.repeat(filledChars)}</Text>
            <Text color={colors.mutedTextColor}>{'░'.repeat(emptyChars)}</Text>
          </Box>
          <Text color={colors.secondaryColor}> {percent}%</Text>
          {
            progress?.text && <Text color={colors.textColor}>{progress.text}</Text>
          }
        </Box>
      );
    } else if (progress.status === 'complete') {
      statusIcon = '✓';
      statusColor = colors.successColor;
    } else if (progress.status === 'failed') {
      statusIcon = '✗';
      statusColor = colors.errorColor;
    }
  } else {
    statusIcon = downloadStatus?.downloaded ? '✓' : '↓';
    statusColor = downloadStatus?.downloaded ? colors.successColor : colors.warningColor;
  }

  return (
    <Box flexDirection="column" width={width}>
      <Box gap={1}>
        <Text flexGrow={1} wrap="truncate" color={isSelected ? colors.secondaryColor : colors.primaryColor}>
          {
            getFileTypeIcon(file.name)
          }
          {isSelected && isFocused ? '> ' : ' '}

          {shortenFileName(name)}
        </Text>
        <Text bold color={statusColor}>{statusIcon}</Text>
      </Box>

      {isSelected && progressBar && (
        <Box marginLeft={2}>
          {progressBar}
        </Box>
      )}

      {isSelected && downloadProgress && downloadProgress[file.name]?.error && (
        <Box marginLeft={2}>
          <Text color={colors.errorColor}>
            Error: {downloadProgress[file.name].error.substring(0, 30)}
            {downloadProgress[file.name].error.length > 30 ? '...' : ''}
          </Text>
        </Box>
      )}
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
  downloadedFiles = {},
  downloadProgress,
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
                  downloadProgress={downloadProgress}
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
