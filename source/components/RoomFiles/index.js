import React, { useEffect, useState } from "react";
import { useChat } from "../../contexts/RoomBaseChatContext.js";
import useKeymap from "../../hooks/useKeymap.js";
import useThemeUpdate from "../../hooks/useThemeUpdate.js";
import { Box, Text } from 'ink';
import FileList from "./RoomFiles.js";

const RoomFiles = ({ onBack }) => {
  const {
    activeRoomId,
    files,
    fileLoading,
    currentDirectory,
    loadRoomFiles,
    navigateDirectory,
    uploadFile,
    downloadFile,
    deleteFile,
    createDirectory
  } = useChat();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const currentTheme = useThemeUpdate();

  // Get files for the active room
  const roomFiles = activeRoomId && files[activeRoomId] ? files[activeRoomId] : [];

  // Get current path for the active room
  const currentPath = activeRoomId ? (currentDirectory[activeRoomId] || '/files') : '/files';

  // Load files on component mount
  useEffect(() => {
    if (activeRoomId) {
      loadRoomFiles(activeRoomId, currentPath);
    }
  }, [activeRoomId, currentPath, loadRoomFiles]);

  // Reset selection when files change
  useEffect(() => {
    setSelectedIndex(0);
  }, [roomFiles.length]);

  // Get selected file
  const selectedFile = selectedIndex >= 0 && selectedIndex < roomFiles.length
    ? roomFiles[selectedIndex]
    : null;

  // Define keymap handlers
  const handlers = {
    navigateUp: () => {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    },
    navigateDown: () => {
      setSelectedIndex(prev => Math.min(roomFiles.length - 1, prev + 1));
    },
    openDir: () => {
      if (selectedFile && selectedFile.isDirectory) {
        navigateDirectory(activeRoomId, selectedFile.path);
      }
    },
    parentDir: () => {
      if (currentPath === '/files' || currentPath === '/') return;

      const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/files';
      navigateDirectory(activeRoomId, parentPath);
    },
    delete: () => {
      if (selectedFile) {
        deleteFile(activeRoomId, selectedFile.path);
      }
    },
    download: () => {
      if (selectedFile && !selectedFile.isDirectory) {
        downloadFile(activeRoomId, selectedFile.path);
      }
    },
    back: onBack,
    exit: onBack,
    refresh: () => {
      loadRoomFiles(activeRoomId, currentPath);
    }
  };

  // Use the keymap hook
  useKeymap('fileExplorer', handlers);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold>
          Room Files {fileLoading ? '(Loading...)' : ''}
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>
          Path: <Text color={currentTheme.colors.secondaryColor}>{currentPath}</Text>
        </Text>
      </Box>

      <FileList
        files={roomFiles}
        selectedIndex={selectedIndex}
        width={50}
      />

      <Box marginTop={1}>
        <Text dimColor>
          ↑/↓: Navigate | Enter: Open folder | Backspace: Parent folder |
          d: Delete | o: Download | r: Refresh | Esc: Back
        </Text>
      </Box>
    </Box>
  );
};

export default RoomFiles;
