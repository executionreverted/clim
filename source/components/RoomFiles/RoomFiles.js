// components/RoomFiles/FileList.js
import React from 'react';
import { Box, Text } from 'ink';
import { filesize } from 'filesize';
import useThemeUpdate from '../../hooks/useThemeUpdate.js';

const FileItem = ({ file, isSelected, colors }) => {
  const { primaryColor, secondaryColor, textColor, mutedTextColor } = colors;

  // Check if it's a directory
  const isDirectory = file.isDirectory;

  // Get filename from path
  const name = file.path.split('/').pop() || file.path;

  // Get file icon based on type
  const getIcon = () => {
    if (isDirectory) return '📁';

    // Check file extension for common types
    const extension = name.split('.').pop().toLowerCase();

    switch (extension) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif': return '🖼️';
      case 'mp3':
      case 'wav': return '🎵';
      case 'mp4':
      case 'avi': return '🎬';
      case 'pdf': return '📑';
      case 'doc':
      case 'docx':
      case 'txt': return '📄';
      default: return '📄';
    }
  };

  const icon = getIcon();

  return (
    <Box>
      <Text
        color={isSelected ? primaryColor : textColor}
        bold={isSelected}
        wrap="truncate"
      >
        {isSelected ? '>' : ' '} {icon} {name}
        {!isDirectory && <Text color={mutedTextColor}> ({filesize(file.size || 0)})</Text>}
      </Text>
    </Box>
  );
};

const FileList = ({ files = [], selectedIndex = 0, width = 40 }) => {
  const currentTheme = useThemeUpdate();
  const {
    primaryColor,
    secondaryColor,
    textColor,
    mutedTextColor,
    borderColor
  } = currentTheme.colors;

  return (
    <Box
      width={width}
      borderStyle="single"
      borderColor={borderColor}
      flexDirection="column"
      padding={1}
    >
      <Box marginBottom={1}>
        <Text bold>Files ({files.length})</Text>
      </Box>

      {files.length === 0 ? (
        <Box>
          <Text color={mutedTextColor} italic>No files in this directory</Text>
        </Box>
      ) : (
        <>
          {files.map((file, index) => (
            <FileItem
              key={file.path}
              file={file}
              isSelected={index === selectedIndex}
              colors={{
                primaryColor,
                secondaryColor,
                textColor,
                mutedTextColor
              }}
            />
          ))}
        </>
      )}
    </Box>
  );
};

export default FileList;
