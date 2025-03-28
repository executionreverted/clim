// Updated RoomFiles/index.js - Enhanced file download feature
import React, { useEffect, useState, useCallback } from "react";
import { Box, Text, useStdout } from 'ink';
import path from 'path';
import fs, { writeFileSync } from 'fs';
import download from 'downloads-folder';
import { useChat } from "../../contexts/RoomBaseChatContext.js";
import useKeymap from "../../hooks/useKeymap.js";
import useThemeUpdate from "../../hooks/useThemeUpdate.js";
import FileList from "./FileList.js";
import FilePreview from "./FilePreview.js";
import NavigationHelp from "./NavigationHelp.js";
import FileUpload from "./FileUpload.js";
import open from 'open'
const RoomFiles = ({ onBack }) => {
  const {
    activeRoomId,
    files,
    fileLoading,
    loadRoomFiles,
    uploadFile,
    downloadFile,
    deleteFile,
    sendMessage,
    TEMP
  } = useChat();

  const { stdout } = useStdout();
  const [terminalWidth, setTerminalWidth] = useState(stdout.columns || 100);
  const [terminalHeight, setTerminalHeight] = useState(stdout.rows || 24);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [visibleStartIndex, setVisibleStartIndex] = useState(0);
  const [previewScrollOffset, setPreviewScrollOffset] = useState(0);
  const [isDeleteConfirmMode, setIsDeleteConfirmMode] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  const currentTheme = useThemeUpdate();

  // Get files for the active room
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

  // Load files on component mount
  useEffect(() => {
    if (activeRoomId) {
      loadRoomFiles(activeRoomId, '/');
    }
  }, [activeRoomId, loadRoomFiles]);

  // Reset selection when files change
  useEffect(() => {
    if (roomFiles.length > 0) {
      setSelectedIndex(Math.min(selectedIndex, roomFiles.length - 1));
      setVisibleStartIndex(Math.min(visibleStartIndex, Math.max(0, roomFiles.length - 1)));
    } else {
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
  const handleDeleteFile = useCallback(() => {
    if (selectedFile) {
      deleteFile(activeRoomId, selectedFile.path)
        .then(() => {
          setIsDeleteConfirmMode(false);
          // Reload files after deletion
          loadRoomFiles(activeRoomId, '/');

          // Send a system message about deletion
          sendMessage(
            activeRoomId,
            `📝 Deleted file: ${selectedFile.name}`,
            true
          );
        })
        .catch(err => {
          console.error('Error deleting file:', err);
        });
    }
    setIsDeleteConfirmMode(false);
  }, [activeRoomId, deleteFile, loadRoomFiles, selectedFile, sendMessage]);

  // Handle file uploading
  const handleFileUpload = useCallback(async (file) => {
    if (!file || !activeRoomId) return false;

    try {
      const result = await uploadFile(activeRoomId, file);
      setShowUploadDialog(false);
      return result;
    } catch (err) {
      console.error('Error uploading file:', err);
      return false;
    }
  }, [activeRoomId, uploadFile]);

  // Handle direct file download
  // Replace the handleDownloadFile function in source/components/RoomFiles/index.js
  const handleDownloadFile = useCallback(async () => {
    if (!selectedFile) return;

    try {
      // Log the selected file contents for debugging
      console.log('Downloading file:', selectedFile);

      // Get the downloads folder path
      const downloadsPath = download();
      console.log('Downloads folder path:', downloadsPath);

      // Construct the full path for saving the file
      const savePath = path.join(downloadsPath, selectedFile.name || 'download.bin');
      console.log('Will save file to:', savePath);

      // Download the file - ensure we pass the proper blob reference
      console.log('Requesting download from room:', activeRoomId);
      let fileData = await downloadFile(activeRoomId, selectedFile);

      // Check if we got data back
      if (!fileData) {
        console.error('No file data returned from downloadFile');
        // Write a log file to help debug
        fs.writeFileSync('./download-failed.log', JSON.stringify({
          file: selectedFile,
          roomId: activeRoomId,
          timestamp: Date.now()
        }, null, 2));
        throw new Error('Failed to download file data');
      }

      // Ensure fileData is a proper Buffer
      if (typeof fileData === 'string') {
        fileData = Buffer.from(fileData);
      } else if (!Buffer.isBuffer(fileData)) {
        // If it's some other object format, try to convert to JSON string and then Buffer
        fileData = Buffer.from(JSON.stringify(fileData));
      }

      // Write the file to the downloads folder with explicit error handling
      try {
        console.log('Writing file to:', savePath, 'size:', fileData.length);
        await fs.promises.writeFile(savePath, fileData);
        console.log('File written successfully');

        // Verify the file was created
        const stats = await fs.promises.stat(savePath);
        console.log('File stats:', stats.size, 'bytes, created at:', stats.birthtime);
      } catch (writeErr) {
        console.error('Error writing file:', writeErr);
        // Try direct synchronous write as fallback
        console.log('Attempting synchronous write as fallback...');
        fs.writeFileSync(savePath, fileData);
        console.log('Sync write completed');
      }

      // Show a success message
      sendMessage(
        activeRoomId,
        `📥 Downloaded file: ${selectedFile.name} to ${savePath}`,
        true
      );

      // Open the downloads folder to show the user where the file is
      try {
        await open(downloadsPath);
      } catch (openErr) {
        console.error('Could not open downloads folder:', openErr);
      }
    } catch (err) {
      console.error('Error downloading file:', err);

      // Send an error message to the room
      if (activeRoomId) {
        sendMessage(
          activeRoomId,
          `❌ Error downloading file: ${selectedFile.name} - ${err.message}`,
          true
        );
      }
    }
  }, [activeRoomId, downloadFile, selectedFile, sendMessage]);
  const handlers = {
    navigateUp: () => {
      if (isDeleteConfirmMode || showUploadDialog) return;
      const newIndex = Math.max(0, selectedIndex - 1);
      setSelectedIndex(newIndex);

      // Update visible window if selection would go out of view
      if (newIndex < visibleStartIndex) {
        setVisibleStartIndex(Math.max(0, newIndex));
      }
    },
    navigateDown: () => {
      if (isDeleteConfirmMode || showUploadDialog) return;
      const newIndex = Math.min(roomFiles.length - 1, selectedIndex + 1);
      setSelectedIndex(newIndex);

      // Update visible window if selection would go out of view
      if (newIndex >= visibleStartIndex + maxVisibleFiles) {
        setVisibleStartIndex(newIndex - maxVisibleFiles + 1);
      }
    },
    pageUp: () => {
      if (isDeleteConfirmMode || showUploadDialog) return;
      const newIndex = Math.max(0, selectedIndex - maxVisibleFiles);
      setSelectedIndex(newIndex);
      setVisibleStartIndex(Math.max(0, newIndex - Math.floor(maxVisibleFiles / 2)));
    },
    pageDown: () => {
      if (isDeleteConfirmMode || showUploadDialog) return;
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
      if (isDeleteConfirmMode || showUploadDialog) return;
      if (selectedFile) {
        setIsDeleteConfirmMode(true);
      }
    },
    download: () => {
      if (isDeleteConfirmMode || showUploadDialog) return;
      handleDownloadFile();
    },
    previewScrollUp: () => {
      if (isDeleteConfirmMode || showUploadDialog) return;
      setPreviewScrollOffset(Math.max(0, previewScrollOffset - 1));
    },
    previewScrollDown: () => {
      if (isDeleteConfirmMode || showUploadDialog) return;
      setPreviewScrollOffset(prev => prev + 1);
    },
    back: () => {
      if (isDeleteConfirmMode) {
        setIsDeleteConfirmMode(false);
        return;
      }
      if (showUploadDialog) {
        setShowUploadDialog(false);
        return;
      }
      onBack();
    },
    exit: () => {
      if (isDeleteConfirmMode) {
        setIsDeleteConfirmMode(false);
        return;
      }
      if (showUploadDialog) {
        setShowUploadDialog(false);
        return;
      }
      onBack();
    },
    refresh: () => {
      if (isDeleteConfirmMode || showUploadDialog) return;
      loadRoomFiles(activeRoomId, '/');
    },
    uploadFile: () => {
      if (isDeleteConfirmMode || showUploadDialog) return;
      setShowUploadDialog(true);
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

      {/* File upload dialog */}
      <FileUpload
        isActive={showUploadDialog}
        onClose={() => setShowUploadDialog(false)}
        onUpload={handleFileUpload}
      />

      {/* Navigation help footer */}
      <NavigationHelp width={terminalWidth} />
    </Box>
  );
};

export default RoomFiles;
