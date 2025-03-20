// components/FileExplorer/index.js
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import FileList from './FileList.js';
import FilePreview from './FilePreview.js';
import NavigationHelp from './NavigationHelp.js';
import { FileExplorerProvider, useFileExplorer } from '../../contexts/FileExplorerContext.js';

// Direct import for 'open' package
import open from 'open';

const FileExplorerContent = ({ mode = 'browse' }) => {
  const { stdout } = useStdout();
  const [terminalWidth, setTerminalWidth] = useState(stdout.columns || 100);
  const [terminalHeight, setTerminalHeight] = useState(stdout.rows || 24);

  const {
    currentPath,
    files,
    selectedIndex,
    setSelectedIndex,
    visibleStartIndex,
    setVisibleStartIndex,
    error,
    previewScrollOffset,
    setPreviewScrollOffset,
    navigateToParent,
    navigateToDirectory,
    goBack,
    selectFile,
    openFileInExplorer
  } = useFileExplorer();

  // Calculate maximum visible files based on terminal height
  // Subtract 6 for header, borders and help footer
  const MAX_VISIBLE_FILES = Math.max(5, terminalHeight - 8);

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

  // Handle file opening with the system's default application
  const handleOpenFile = async () => {
    if (files[selectedIndex] && !files[selectedIndex].isDirectory) {
      try {
        await open(files[selectedIndex].path);
      } catch (err) {
        console.error('Failed to open file:', err);
      }
    }
  };

  // Handle file list navigation
  useInput((input, key) => {
    if (key.upArrow) {
      const newIndex = Math.max(-1, selectedIndex - 1);
      setSelectedIndex(newIndex);

      // Update visible window if selection would go out of view
      if (newIndex < visibleStartIndex) {
        setVisibleStartIndex(Math.max(0, newIndex));
      }
    } else if (key.downArrow) {
      const newIndex = Math.min(files.length - 1, selectedIndex + 1);
      setSelectedIndex(newIndex);

      // Update visible window if selection would go out of view
      if (newIndex >= visibleStartIndex + MAX_VISIBLE_FILES) {
        setVisibleStartIndex(newIndex - MAX_VISIBLE_FILES + 1);
      }
    } else if (key.pageUp) {
      // Page up: move selection up by page size
      const newIndex = Math.max(-1, selectedIndex - MAX_VISIBLE_FILES);
      setSelectedIndex(newIndex);
      setVisibleStartIndex(Math.max(0, newIndex - Math.floor(MAX_VISIBLE_FILES / 2)));
    } else if (key.pageDown) {
      // Page down: move selection down by page size
      const newIndex = Math.min(files.length - 1, selectedIndex + MAX_VISIBLE_FILES);
      setSelectedIndex(newIndex);
      setVisibleStartIndex(Math.max(0, Math.min(
        files.length - MAX_VISIBLE_FILES,
        newIndex - Math.floor(MAX_VISIBLE_FILES / 2)
      )));
    } else if (key.return) {
      if (selectedIndex === -1) {
        // Go to parent directory when ".." is selected
        navigateToParent();
      } else if (files[selectedIndex]) {
        if (files[selectedIndex].isDirectory) {
          navigateToDirectory(files[selectedIndex]);
        } else if (mode === 'picker') {
          // In picker mode, Enter selects the file
          selectFile(files[selectedIndex]);
        }
      }
    } else if (input === 'b') {
      goBack();
    } else if (input === 'h' || key.delete) {
      navigateToParent();
    } else if (input === 'o') {
      // 'o' to open file in system default application
      handleOpenFile();
    } else if (input === 'p' && mode === 'browse') {
      // 'p' to pick/select a file in browse mode
      if (selectedIndex >= 0 && files[selectedIndex] && !files[selectedIndex].isDirectory) {
        selectFile(files[selectedIndex]);
      }
    }
  });

  // Get the currently selected file
  const selectedFile = files[selectedIndex];

  return (
    <Box
      flexDirection="column"
      width={terminalWidth}
      height={terminalHeight}
    >
      <Box width={terminalWidth} paddingX={1}>
        <Text bold wrap="truncate">
          File Explorer {mode === 'picker' ? '(Select a file)' : ''}
        </Text>
      </Box>

      <Box width={terminalWidth} paddingX={1}>
        <Text wrap="truncate">Path: <Text color="blue">{
          currentPath.length > terminalWidth - 10
            ? '...' + currentPath.substring(currentPath.length - (terminalWidth - 10))
            : currentPath
        }</Text></Text>
      </Box>

      {error ? (
        <Box width={terminalWidth} paddingX={1}>
          <Text color="red" wrap="truncate">{error}</Text>
        </Box>
      ) : (
        <Box height={terminalHeight - 10} paddingX={1}>
          {/* Split view with files on left and preview on right */}
          <Box flexDirection="row" width={terminalWidth - 2}>
            {/* File list panel */}
            <FileList
              files={files}
              selectedIndex={selectedIndex}
              visibleStartIndex={visibleStartIndex}
              maxVisibleFiles={MAX_VISIBLE_FILES}
              width={Math.floor((terminalWidth - 4) * 0.4)}
            />

            {/* Preview panel */}
            <FilePreview
              selectedFile={selectedFile}
              previewScrollOffset={previewScrollOffset}
              setPreviewScrollOffset={setPreviewScrollOffset}
              width={Math.floor((terminalWidth - 4) * 0.6)}
              maxPreviewLines={MAX_VISIBLE_FILES}
            />
          </Box>
        </Box>
      )}

      <Box marginTop={1} width={terminalWidth}>
        <NavigationHelp width={terminalWidth} showPickOption={mode === 'browse'} />
      </Box>
    </Box>
  );
};

const FileExplorer = ({
  initialPath,
  onBack,
  onFileSelect,
  mode = 'browse' // 'browse' or 'picker'
}) => {
  return (
    <FileExplorerProvider initialPath={initialPath} onFileSelect={onFileSelect} onBack={onBack}>
      <FileExplorerContent mode={mode} />
    </FileExplorerProvider>
  );
};

export default FileExplorer;
