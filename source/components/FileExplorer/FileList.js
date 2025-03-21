// components/FileExplorer/FileList.js
import React, { memo } from 'react';
import { Box, Text } from 'ink';
import { filesize } from 'filesize';
import { useFileExplorer } from '../../contexts/FileExplorerContext.js';

// Memoized file item component to prevent unnecessary re-renders
const FileItem = memo(({ item, index, selectedIndex, multiSelect, selectedFiles, width, MAX_FILENAME_LENGTH }) => {
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
    <Box width={width - 4}>
      <Text color={isSelected ? 'green' : undefined} wrap="truncate">
        {isCursorSelected} {multiSelect ? multiSelectIndicator : ''} {icon} {displayName}
        <Text color="gray">{sizeText}</Text>
      </Text>
    </Box>
  );
});

// Memoized parent directory option
const ParentDirectoryItem = memo(({ selectedIndex, multiSelect, width }) => (
  <Box width={width - 4}>
    <Text color={selectedIndex === -1 ? 'green' : undefined} wrap="truncate">
      {selectedIndex === -1 ? '>' : ' '} {multiSelect ? '   ' : ''} 📁 ..
    </Text>
  </Box>
));

// Memoized pagination indicator
const PaginationIndicator = memo(({ direction, count, width }) => (
  <Box width={width - 4}>
    <Text color="yellow" wrap="truncate">
      {direction === 'up' ? '↑ More items above' : `↓ More (${count})`}
    </Text>
  </Box>
));

const FileList = ({ files, selectedIndex, visibleStartIndex, maxVisibleFiles, width = 40 }) => {
  // Get multiselect state from context
  const { multiSelect, selectedFiles } = useFileExplorer();

  // Adjust filename length based on available width
  const MAX_FILENAME_LENGTH = Math.max(10, Math.floor(width * 0.6));

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle="single"
      borderColor="gray"
      padding={1}
    >
      {files.length === 0 ? (
        <Box width={width - 4}>
          <Text color="yellow" wrap="truncate">This directory is empty</Text>
        </Box>
      ) : (
        <>
          {/* Parent directory option */}
          <ParentDirectoryItem
            selectedIndex={selectedIndex}
            multiSelect={multiSelect}
            width={width}
          />

          {/* Pagination indicator */}
          {visibleStartIndex > 0 && (
            <PaginationIndicator direction="up" width={width} />
          )}

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

          {/* Pagination indicator */}
          {visibleStartIndex + maxVisibleFiles < files.length && (
            <PaginationIndicator
              direction="down"
              count={files.length - visibleStartIndex - maxVisibleFiles}
              width={width}
            />
          )}
        </>
      )}
    </Box>
  );
};

export default FileList;
