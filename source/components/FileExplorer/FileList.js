// components/FileExplorer/FileList.js
import React from 'react';
import { Box, Text } from 'ink';
import { filesize } from 'filesize';

const FileList = ({ files, selectedIndex, visibleStartIndex, maxVisibleFiles, width = 40 }) => {
  // Adjust filename length based on available width
  const MAX_FILENAME_LENGTH = Math.max(10, Math.floor(width * 0.6));

  const renderFileItem = (item, index) => {
    const isSelected = index === selectedIndex;
    const indicator = isSelected ? '>' : ' ';
    const icon = item.isDirectory ? '📁' : '📄';

    // Truncate filename if too long
    const displayName = item.name.length > MAX_FILENAME_LENGTH
      ? item.name.substring(0, MAX_FILENAME_LENGTH - 3) + '...'
      : item.name;

    // Format file size
    const sizeText = !item.isDirectory ? ` (${filesize(item.size)})` : '';

    return (
      <Box key={item.path} width={width - 4}>
        <Text color={isSelected ? 'green' : undefined} wrap="truncate">
          {indicator} {icon} {displayName}
          <Text color="gray">{sizeText}</Text>
        </Text>
      </Box>
    );
  };

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
          {/* Pagination indicator */}
          {visibleStartIndex > 0 && (
            <Box width={width - 4}>
              <Text color="yellow" wrap="truncate">↑ More items above</Text>
            </Box>
          )}

          {/* Visible files */}
          {files
            .slice(visibleStartIndex, visibleStartIndex + maxVisibleFiles)
            .map((file, idx) => renderFileItem(file, idx + visibleStartIndex))}

          {/* Pagination indicator */}
          {visibleStartIndex + maxVisibleFiles < files.length && (
            <Box width={width - 4}>
              <Text color="yellow" wrap="truncate">↓ More ({files.length - visibleStartIndex - maxVisibleFiles})</Text>
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default FileList;

export default FileList;
