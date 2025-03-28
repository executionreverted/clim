// components/FileExplorer/FileList.js
import React, { memo } from 'react';
import { Box, Text } from 'ink';
import { filesize } from 'filesize';
import { useFileExplorer } from '../../contexts/FileExplorerContext.js';
import useThemeUpdate from '../../hooks/useThemeUpdate.js';

// Memoized file item component to prevent unnecessary re-renders
const FileItem = memo(({ item, index, selectedIndex, multiSelect, selectedFiles, width, MAX_FILENAME_LENGTH }) => {
  const {
    secondaryColor,
    textColor,
    mutedTextColor,
  } = useThemeUpdate().colors
  const isSelected = index === selectedIndex;
  const isCursorSelected = isSelected ? '>' : ' ';
  const icon = item.isDirectory ? '📁' : '📄';

  // Check if file is in the multiselect array
  const isMultiSelected = multiSelect &&
    selectedFiles.some(file => file.path === item.path);

  // Show selection indicator if multiselect is enabled
  const multiSelectIndicator = multiSelect
    ? (isMultiSelected ? '[✓]' : '[ ]')
    : '';

  // Truncate filename if too long
  const displayName = item.name.length > MAX_FILENAME_LENGTH
    ? item.name.substring(0, MAX_FILENAME_LENGTH - 3) + '...'
    : item.name;

  // Format file size
  const sizeText = !item.isDirectory ? ` (${filesize(item.size)})` : '';

  return (
    <Box overflow={"hidden"} width={width - 4}>
      <Text color={isSelected ? secondaryColor : textColor} wrap="truncate">
        {isCursorSelected} {multiSelect ? multiSelectIndicator : ''} {icon} {displayName}
        <Text color={mutedTextColor}>{sizeText}</Text>
      </Text>
    </Box>
  );
});

// Memoized parent directory option
const ParentDirectoryItem = memo(({ direction, selectedIndex, multiSelect, width }) => {
  const {
    textColor,
    successColor,
  } = useThemeUpdate().colors
  return <Box width={width - 4}>
    <Text color={selectedIndex === -1 ? successColor : textColor} wrap="truncate">
      {selectedIndex === -1 ? '>' : ' '} {multiSelect ? '   ' : ''} 📁 ..
      {selectedIndex > -1 ? direction === 'up' ? '↑ More above' : `↓ More below` : ''}
    </Text>
  </Box>
});



const FileList = ({ files, selectedIndex, visibleStartIndex, maxVisibleFiles, width = 40 }) => {
  const {
    textColor,
    borderColor,
  } = useThemeUpdate().colors;

  // Get multiselect state from context
  const { multiSelect, selectedFiles } = useFileExplorer();

  // Adjust filename length based on available width
  const MAX_FILENAME_LENGTH = Math.max(10, Math.floor(width * 0.6));

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle="single"
      borderColor={borderColor}
      padding={1}
    >
      {files.length === 0 ? (
        <Box width={width - 4}>
          <Text color={textColor} wrap="truncate">This directory is empty</Text>
        </Box>
      ) : (
        <>
          {/* Parent directory option */}
          <ParentDirectoryItem
            direction={visibleStartIndex > 0 ? "up" : "down"}
            selectedIndex={selectedIndex}
            multiSelect={multiSelect}
            width={width}
          />

          {/* Visible files */}
          {files
            .slice(visibleStartIndex, visibleStartIndex + maxVisibleFiles)
            .map((file, idx) => (
              <FileItem
                key={file.path}
                item={file}
                index={idx + visibleStartIndex}
                selectedIndex={selectedIndex}
                multiSelect={multiSelect}
                selectedFiles={selectedFiles}
                width={width}
                MAX_FILENAME_LENGTH={MAX_FILENAME_LENGTH}
              />
            ))}

        </>
      )}
    </Box>
  );
};

export default FileList;
