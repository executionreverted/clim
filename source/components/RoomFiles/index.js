// Simplified RoomFiles Component for flat file listing
import React, { useEffect, useState } from "react";
import { Box, Text, useStdout } from 'ink';
import { useChat } from "../../contexts/RoomBaseChatContext.js";
import useKeymap from "../../hooks/useKeymap.js";
import useThemeUpdate from "../../hooks/useThemeUpdate.js";
import FileList from "./FileList.js";
import FilePreview from "./FilePreview.js";
import NavigationHelp from "./NavigationHelp.js";

const RoomFiles = ({ onBack }) => {
  const {
    activeRoomId,
    files,
    fileLoading,
    loadRoomFiles,
    uploadFile,
    downloadFile,
    deleteFile
  } = useChat();

  const { stdout } = useStdout();
  const [terminalWidth, setTerminalWidth] = useState(stdout.columns || 100);
  const [terminalHeight, setTerminalHeight] = useState(stdout.rows || 24);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [visibleStartIndex, setVisibleStartIndex] = useState(0);
  const [previewScrollOffset, setPreviewScrollOffset] = useState(0);
  const [isDeleteConfirmMode, setIsDeleteConfirmMode] = useState(false);

  const currentTheme = useThemeUpdate();

  // Get files for the active room - always flat
  const roomFiles = activeRoomId && files[activeRoomId] ? files[activeRoomId] : [];

  // Update terminal dimensions if they change
  useEffect(() => {
    const handleResize = () => {
      setTerminalWidth(stdout.columns);
      setTerminalHeight(stdout.rows);
    };

    stdout.on('resize', handleResize);
    return () => {
      stdout.off('resize', handleResize);
    };
  }, [stdout]);

  // Load files on component mount - just once
  useEffect(() => {
    if (activeRoomId) {
      loadRoomFiles(activeRoomId, '/');
    }
  }, [activeRoomId, loadRoomFiles]);

  // Reset selection when files change
  useEffect(() => {
    if (roomFiles.length > 0) {
      setSelectedIndex(0);
      setVisibleStartIndex(0);
    }
  }, [roomFiles.length]);

  // Calculate panel dimensions
  const listWidth = Math.floor(terminalWidth * 0.4);
  const previewWidth = terminalWidth - listWidth - 4; // Account for borders and spacing
  const contentHeight = terminalHeight - 8; // Account for header, footer, borders
  const maxVisibleFiles = Math.max(5, contentHeight - 4);

  // Get selected file
  const selectedFile = selectedIndex >= 0 && selectedIndex < roomFiles.length
    ? roomFiles[selectedIndex]
    : null;

  // Handle file deletion
  const handleDeleteFile = () => {
    if (selectedFile) {
      deleteFile(activeRoomId, selectedFile.path)
        .then(() => {
          setIsDeleteConfirmMode(false);
          // Reload files after deletion
          loadRoomFiles(activeRoomId, '/');
        })
        .catch(err => {
          console.error('Error deleting file:', err);
        });
    }
    setIsDeleteConfirmMode(false);
  };

  // Handle file downloading
  const handleDownloadFile = async () => {
    if (selectedFile && !selectedFile.isDirectory) {
      try {
        await downloadFile(activeRoomId, selectedFile.path, selectedFile.name);
      } catch (err) {
        console.error('Error downloading file:', err);
      }
    }
  };

  // Define keymap handlers
  const handlers = {
    navigateUp: () => {
      if (isDeleteConfirmMode) return;
      const newIndex = Math.max(0, selectedIndex - 1);
      setSelectedIndex(newIndex);

      // Update visible window if selection would go out of view
      if (newIndex < visibleStartIndex) {
        setVisibleStartIndex(Math.max(0, newIndex));
      }
    },
    navigateDown: () => {
      if (isDeleteConfirmMode) return;
      const newIndex = Math.min(roomFiles.length - 1, selectedIndex + 1);
      setSelectedIndex(newIndex);

      // Update visible window if selection would go out of view
      if (newIndex >= visibleStartIndex + maxVisibleFiles) {
        setVisibleStartIndex(newIndex - maxVisibleFiles + 1);
      }
    },
    pageUp: () => {
      if (isDeleteConfirmMode) return;
      const newIndex = Math.max(0, selectedIndex - maxVisibleFiles);
      setSelectedIndex(newIndex);
      setVisibleStartIndex(Math.max(0, newIndex - Math.floor(maxVisibleFiles / 2)));
    },
    pageDown: () => {
      if (isDeleteConfirmMode) return;
      const newIndex = Math.min(roomFiles.length - 1, selectedIndex + maxVisibleFiles);
      setSelectedIndex(newIndex);
      setVisibleStartIndex(Math.max(0, Math.min(
        roomFiles.length - maxVisibleFiles,
        newIndex - Math.floor(maxVisibleFiles / 2)
      )));
    },
    openDir: () => {
      if (isDeleteConfirmMode) {
        handleDeleteFile();
        return;
      }
    },
    delete: () => {
      if (isDeleteConfirmMode) return;
      if (selectedFile) {
        setIsDeleteConfirmMode(true);
      }
    },
    download: () => {
      if (isDeleteConfirmMode) return;
      handleDownloadFile();
    },
    previewScrollUp: () => {
      if (isDeleteConfirmMode) return;
      setPreviewScrollOffset(Math.max(0, previewScrollOffset - 1));
    },
    previewScrollDown: () => {
      if (isDeleteConfirmMode) return;
      setPreviewScrollOffset(prev => prev + 1);
    },
    back: () => {
      if (isDeleteConfirmMode) {
        setIsDeleteConfirmMode(false);
        return;
      }
      onBack();
    },
    exit: onBack,
    refresh: () => {
      if (isDeleteConfirmMode) return;
      loadRoomFiles(activeRoomId, '/');
    }
  };

  // Use the keymap hook
  useKeymap('fileExplorer', handlers);

  return (
    <Box
      flexDirection="column"
      width={terminalWidth}
      height={terminalHeight}
    >
      {/* Header */}
      <Box
        width={terminalWidth}
        borderStyle="single"
        borderColor={currentTheme.colors.borderColor}
        padding={1}
      >
        <Text bold>
          Room Files
          {fileLoading ? ' (Loading...)' : `(${roomFiles.length} files)`}
        </Text>
      </Box>

      {/* Main content */}
      <Box
        flexDirection="row"
        height={contentHeight}
      >
        {/* File list panel */}
        <FileList
          files={roomFiles}
          selectedIndex={selectedIndex}
          visibleStartIndex={visibleStartIndex}
          maxVisibleFiles={maxVisibleFiles}
          width={listWidth}
          height={contentHeight}
          currentPath="/"
          isFocused={true}
        />

        {/* Preview panel */}
        <FilePreview
          file={selectedFile}
          width={previewWidth}
          height={contentHeight}
          scrollOffset={previewScrollOffset}
          activeRoomId={activeRoomId}
          downloadFile={downloadFile}
        />
      </Box>

      {/* Delete confirmation modal */}
      {isDeleteConfirmMode && selectedFile && (
        <Box
          position="absolute"
          top={Math.floor(terminalHeight / 2) - 4}
          left={Math.floor(terminalWidth / 2) - 20}
          width={40}
          height={7}
          borderStyle="round"
          borderColor={currentTheme.colors.errorColor}
          backgroundColor="#000"
          padding={1}
          flexDirection="column"
        >
          <Text bold color={currentTheme.colors.errorColor}>Confirm Delete</Text>

          <Box marginTop={1} flexDirection="column">
            <Text>Delete file:</Text>
            <Text color={currentTheme.colors.secondaryColor}>{selectedFile.name}</Text>
          </Box>

          <Box marginTop={1} justifyContent="flex-end">
            <Text color={currentTheme.colors.mutedTextColor}>
              [Enter] Confirm | [Esc] Cancel
            </Text>
          </Box>
        </Box>
      )}

      {/* Navigation help footer */}
      <NavigationHelp width={terminalWidth} />
    </Box>
  );
};

export default RoomFiles;
