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
import open from 'open'

const RoomFiles = ({ onBack }) => {
  const {
    activeRoomId,
    files,
    fileLoading,
    loadRoomFiles,
    downloadFile,
    deleteFile,
    sendMessage,
    downloading,
    downloadProgress,
  } = useChat();

  const { stdout } = useStdout();
  const [terminalWidth, setTerminalWidth] = useState(stdout.columns || 100);
  const [terminalHeight, setTerminalHeight] = useState(stdout.rows || 24);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [visibleStartIndex, setVisibleStartIndex] = useState(0);
  const [previewScrollOffset, setPreviewScrollOffset] = useState(0);
  const [isDeleteConfirmMode, setIsDeleteConfirmMode] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [downloadedFiles, setDownloadedFiles] = useState({});
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

  // Replace the handleDownloadFile function in source/components/RoomFiles/index.js
  const handleDownloadFile = useCallback(async () => {

    const downloadsPath = download();
    if (!selectedFile) {
      return;
    }

    if (downloadedFiles[selectedFile.name].downloaded) {
      open(downloadsPath)
      return
    }

    try {
      // Get the downloads folder path
      const downloadsPath = download();

      // Construct the full path for saving the file
      const savePath = path.join(downloadsPath, selectedFile.name || 'download.bin');

      // Download the file - ensure we pass the proper blob reference
      let fileData = await downloadFile(activeRoomId, selectedFile);

      // Check if we got data back
      if (!fileData) {
        throw new Error('Failed to download file data');
      }
      // If fileData is a Buffer, write it directly
      if (Buffer.isBuffer(fileData)) {
        fs.writeFileSync(savePath, fileData);
      } else if (typeof fileData === 'string') {
        // If it's a string, convert to Buffer
        fs.writeFileSync(savePath, Buffer.from(fileData));
      } else {
        // Otherwise try to stringify the object
        fs.writeFileSync(savePath, Buffer.from(JSON.stringify(fileData, null, 2)));
      }


      // Show a success message
      sendMessage(
        activeRoomId,
        `📥 Downloaded file: ${selectedFile.name} to ${savePath}`,
        true
      );

      // Open the downloads folder to show the user where the file is
      try {
        checkDownloadStatus()
        await open(downloadsPath);
      } catch (openErr) {
        console.error('Could not open downloads folder:', openErr);
      }
    } catch (err) {
      console.error('Error in handleDownloadFile:', err);

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
      if (downloading || isDeleteConfirmMode || showUploadDialog) return;
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
  const checkDownloadStatus = async () => {
    const downloadsPath = download();
    const statusMap = {};
    const detailedStatusMap = {};

    for (const file of roomFiles) {
      const fileName = file.name || path.basename(file.path || '');
      const downloadPath = path.join(downloadsPath, fileName);

      // Check file existence
      const fileExists = fs.existsSync(downloadPath);

      // Get additional file information if downloaded
      if (fileExists) {
        try {
          const stats = fs.statSync(downloadPath);
          detailedStatusMap[fileName] = {
            downloaded: true,
            size: stats.size,
            lastModified: stats.mtime
          };
        } catch {
          detailedStatusMap[fileName] = { downloaded: true };
        }
      } else {
        detailedStatusMap[fileName] = { downloaded: false };
      }

      statusMap[fileName] = fileExists;
    }

    setDownloadedFiles(detailedStatusMap);
  };

  useEffect(() => {
    checkDownloadStatus();
  }, [files, roomFiles, roomFiles.length]);

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

          {downloading ? 'Downloading file...' : ''}
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
          downloadedFiles={downloadedFiles}
          downloadProgress={downloadProgress}
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
      {/* <FileUpload */}
      {/*   isActive={showUploadDialog} */}
      {/*   onClose={() => setShowUploadDialog(false)} */}
      {/*   onUpload={handleFileUpload} */}
      {/* /> */}

      {/* Navigation help footer */}
      <NavigationHelp width={terminalWidth} />
    </Box>
  );
};

export default RoomFiles;
