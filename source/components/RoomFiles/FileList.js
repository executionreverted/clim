// source/components/RoomFiles/index.js
import React, { useEffect, useState, useRef } from "react";
import { Box, Text, useStdout } from 'ink';
import { useChat } from "../../contexts/RoomBaseChatContext.js";
import useKeymap from "../../hooks/useKeymap.js";
import useThemeUpdate from "../../hooks/useThemeUpdate.js";
import FileList from "./FileList.js";
import FilePreview from "./FilePreview.js";
import NavigationHelp from "./NavigationHelp.js";
import FileUpload from "./FileUpload.js";
import mime from 'mime-types';
import path from 'path';

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

  const { stdout } = useStdout();
  const [terminalWidth, setTerminalWidth] = useState(stdout.columns || 100);
  const [terminalHeight, setTerminalHeight] = useState(stdout.rows || 24);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [visibleStartIndex, setVisibleStartIndex] = useState(0);
  const [previewScrollOffset, setPreviewScrollOffset] = useState(0);
  const [isCreateFolderMode, setIsCreateFolderMode] = useState(false);
  const [folderNameInput, setFolderNameInput] = useState('');
  const [isDeleteConfirmMode, setIsDeleteConfirmMode] = useState(false);
  const [isUploadMode, setIsUploadMode] = useState(false);
  const fileInputRef = useRef(null);

  const currentTheme = useThemeUpdate();

  // Get files for the active room
  const roomFiles = activeRoomId && files[activeRoomId] ? files[activeRoomId] : [];

  // Get current path for the active room
  const currentPath = activeRoomId ? (currentDirectory[activeRoomId] || '/files') : '/files';

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

  // Load files on component mount
  useEffect(() => {
    if (activeRoomId) {
      loadRoomFiles(activeRoomId, currentPath);
    }
  }, [activeRoomId, currentPath, loadRoomFiles]);

  // Reset selection when files change
  useEffect(() => {
    setSelectedIndex(0);
    setVisibleStartIndex(0);
  }, [roomFiles.length, currentPath]);

  // Calculate panel dimensions
  const listWidth = Math.floor(terminalWidth * 0.4);
  const previewWidth = terminalWidth - listWidth - 4; // Account for borders and spacing
  const contentHeight = terminalHeight - 8; // Account for header, footer, borders
  const maxVisibleFiles = Math.max(5, contentHeight - 4);

  // Get selected file
  const selectedFile = selectedIndex >= 0 && selectedIndex < roomFiles.length
    ? roomFiles[selectedIndex]
    : null;

  // Handle folder creation
  const handleCreateFolder = () => {
    if (folderNameInput.trim()) {
      const newFolderPath = path.join(currentPath, folderNameInput.trim());
      createDirectory(activeRoomId, newFolderPath)
        .then(() => {
          setIsCreateFolderMode(false);
          setFolderNameInput('');
        })
        .catch(err => {
          console.error('Error creating folder:', err);
        });
    }
    setIsCreateFolderMode(false);
    setFolderNameInput('');
  };

  // Handle file deletion
  const handleDeleteFile = () => {
    if (selectedFile) {
      deleteFile(activeRoomId, selectedFile.path)
        .then(() => {
          setIsDeleteConfirmMode(false);
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

  // Handle file upload
  const handleFileUpload = async (file) => {
    try {
      if (!file || !file.path) return false;

      // Read file data
      const fileData = await fs.promises.readFile(file.path);

      // Determine target path in the room's drive
      const targetPath = path.join(currentPath, file.name);

      // Upload the file
      const success = await uploadFile(activeRoomId, {
        ...file,
        arrayBuffer: async () => fileData
      }, targetPath);

      if (success) {
        // Refresh the file list
        await loadRoomFiles(activeRoomId, currentPath);
        return true;
      }

      return false;
    } catch (err) {
      console.error('Error in handleFileUpload:', err);
      return false;
    }
  };

  // Define keymap handlers
  const handlers = {
    navigateUp: () => {
      if (isCreateFolderMode || isDeleteConfirmMode) return;
      const newIndex = Math.max(0, selectedIndex - 1);
      setSelectedIndex(newIndex);

      // Update visible window if selection would go out of view
      if (newIndex < visibleStartIndex) {
        setVisibleStartIndex(Math.max(0, newIndex));
      }
    },
    navigateDown: () => {
      if (isCreateFolderMode || isDeleteConfirmMode) return;
      const newIndex = Math.min(roomFiles.length - 1, selectedIndex + 1);
      setSelectedIndex(newIndex);

      // Update visible window if selection would go out of view
      if (newIndex >= visibleStartIndex + maxVisibleFiles) {
        setVisibleStartIndex(newIndex - maxVisibleFiles + 1);
      }
    },
    pageUp: () => {
      if (isCreateFolderMode || isDeleteConfirmMode) return;
      const newIndex = Math.max(0, selectedIndex - maxVisibleFiles);
      setSelectedIndex(newIndex);
      setVisibleStartIndex(Math.max(0, newIndex - Math.floor(maxVisibleFiles / 2)));
    },
    pageDown: () => {
      if (isCreateFolderMode || isDeleteConfirmMode) return;
      const newIndex = Math.min(roomFiles.length - 1, selectedIndex + maxVisibleFiles);
      setSelectedIndex(newIndex);
      setVisibleStartIndex(Math.max(0, Math.min(
        roomFiles.length - maxVisibleFiles,
        newIndex - Math.floor(maxVisibleFiles / 2)
      )));
    },
    openDir: () => {
      if (isCreateFolderMode) {
        handleCreateFolder();
        return;
      }
      if (isDeleteConfirmMode) {
        handleDeleteFile();
        return;
      }
      if (selectedFile && selectedFile.isDirectory) {
        navigateDirectory(activeRoomId, selectedFile.path);
      }
    },
    parentDir: () => {
      if (isCreateFolderMode || isDeleteConfirmMode) {
        setIsCreateFolderMode(false);
        setIsDeleteConfirmMode(false);
        return;
      }
      if (currentPath === '/files' || currentPath === '/') return;

      const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/files';
      navigateDirectory(activeRoomId, parentPath);
    },
    delete: () => {
      if (isCreateFolderMode || isDeleteConfirmMode) return;
      if (selectedFile) {
        setIsDeleteConfirmMode(true);
      }
    },
    download: () => {
      if (isCreateFolderMode || isDeleteConfirmMode) return;
      handleDownloadFile();
    },
    previewScrollUp: () => {
      if (isCreateFolderMode || isDeleteConfirmMode) return;
      setPreviewScrollOffset(Math.max(0, previewScrollOffset - 1));
    },
    previewScrollDown: () => {
      if (isCreateFolderMode || isDeleteConfirmMode || isUploadMode) return;
      setPreviewScrollOffset(prev => prev + 1); // No upper limit needed, FilePreview component will handle it
    },
    newFolder: () => {
      if (isCreateFolderMode || isDeleteConfirmMode || isUploadMode) return;
      setIsCreateFolderMode(true);
      setFolderNameInput('');
    },
    uploadFile: () => {
      if (isCreateFolderMode || isDeleteConfirmMode || isUploadMode) return;
      setIsUploadMode(true);
    },
    back: () => {
      if (isCreateFolderMode) {
        setIsCreateFolderMode(false);
        return;
      }
      if (isDeleteConfirmMode) {
        setIsDeleteConfirmMode(false);
        return;
      }
      if (isUploadMode) {
        setIsUploadMode(false);
        return;
      }
      onBack();
    },
    exit: onBack,
    refresh: () => {
      if (isCreateFolderMode || isDeleteConfirmMode) return;
      loadRoomFiles(activeRoomId, currentPath);
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
          Room Files: <Text color={currentTheme.colors.secondaryColor}>{currentPath}</Text>
          {fileLoading ? ' (Loading...)' : `(${roomFiles.length} items)`}
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
          currentPath={currentPath}
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

      {/* Folder creation modal */}
      {isCreateFolderMode && (
        <Box
          position="absolute"
          top={Math.floor(terminalHeight / 2) - 4}
          left={Math.floor(terminalWidth / 2) - 20}
          width={40}
          height={7}
          borderStyle="round"
          borderColor={currentTheme.colors.primaryColor}
          backgroundColor="#000"
          padding={1}
          flexDirection="column"
        >
          <Text bold>Create New Folder</Text>

          <Box marginTop={1}>
            <Text>Enter folder name: </Text>
            <Text color={currentTheme.colors.primaryColor}>{folderNameInput}</Text>
          </Box>

          <Box marginTop={1} justifyContent="flex-end">
            <Text color={currentTheme.colors.mutedTextColor}>
              [Enter] Create | [Esc] Cancel
            </Text>
          </Box>
        </Box>
      )}

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
            <Text>Delete {selectedFile.isDirectory ? 'folder' : 'file'}:</Text>
            <Text color={currentTheme.colors.secondaryColor}>{selectedFile.name || path.basename(selectedFile.path)}</Text>
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

      {/* File upload modal */}
      <FileUpload
        isActive={isUploadMode}
        onClose={() => setIsUploadMode(false)}
        onUpload={handleFileUpload}
        currentPath={currentPath}
      />
    </Box>
  );
};

export default RoomFiles;
