// components/FileExplorer/index.js
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import fs from 'fs';
import path from 'path';

import FileList from './FileList.js';
import FilePreview from './FilePreview.js';
import NavigationHelp from './NavigationHelp.js';
import { loadDirectory } from './utils.js';

const FileExplorer = ({ onBack }) => {

  const { stdout } = useStdout();
  const [terminalWidth, setTerminalWidth] = useState(stdout.columns || 100);
  const [terminalHeight, setTerminalHeight] = useState(stdout.rows || 24);
  const [currentPath, setCurrentPath] = useState(process.cwd());
  const [files, setFiles] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [visibleStartIndex, setVisibleStartIndex] = useState(0);
  const [error, setError] = useState('');
  const [previewScrollOffset, setPreviewScrollOffset] = useState(0);

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

  // Load directory contents on path change
  useEffect(() => {
    loadDirectory(currentPath, setFiles, setSelectedIndex, setError, setVisibleStartIndex);
  }, [currentPath]);

  // Reset preview scroll when selecting a different file
  useEffect(() => {
    setPreviewScrollOffset(0);
  }, [selectedIndex]);

  const navigateToParent = () => {
    const parentPath = path.dirname(currentPath);
    if (parentPath !== currentPath) {
      setCurrentPath(parentPath);
    }
  };

  const navigateToDirectory = (item) => {
    if (item.isDirectory) {
      setCurrentPath(item.path);
    }
  };

  // Handle file list navigation
  useInput((input, key) => {
    if (key.upArrow) {
      const newIndex = Math.max(0, selectedIndex - 1);
      setSelectedIndex(newIndex);

      // Update visible window if selection would go out of view
      if (newIndex < visibleStartIndex) {
        setVisibleStartIndex(newIndex);
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
      const newIndex = Math.max(0, selectedIndex - MAX_VISIBLE_FILES);
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
      if (files[selectedIndex]) {
        navigateToDirectory(files[selectedIndex]);
      }
    } else if (input === 'b') {
      onBack();
    } else if (input === 'h' || key.backspace) {
      navigateToParent();
    }
  });

  // Get the currently selected file
  const selectedFile = files[selectedIndex];

  return (
    <Box
      flexDirection="column"
      width={terminalWidth}
      height={terminalHeight}
      padding={0}
    >
      <Box width={terminalWidth} paddingX={1}>
        <Text bold wrap="truncate">File Explorer</Text>
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
        <Box height={terminalHeight - 6} paddingX={1}>
          {/* Split view with files on left and preview on right */}
          <Box flexDirection="row" width={terminalWidth - 2}>
            {/* File list panel */}
            <FileList
              files={files}
              selectedIndex={selectedIndex}
              visibleStartIndex={visibleStartIndex}
              maxVisibleFiles={MAX_VISIBLE_FILES}
              width={Math.floor((terminalWidth - 4) * 0.5)}
            />

            {/* Preview panel */}
            <FilePreview
              selectedFile={selectedFile}
              previewScrollOffset={previewScrollOffset}
              setPreviewScrollOffset={setPreviewScrollOffset}
              width={Math.floor((terminalWidth - 4) * 0.5)}
              maxPreviewLines={MAX_VISIBLE_FILES}
            />
          </Box>
        </Box>
      )}

      <Box position="absolute" bottom={0} width={terminalWidth}>
        <NavigationHelp width={terminalWidth} />
      </Box>
    </Box>
  );
};

export default FileExplorer;
