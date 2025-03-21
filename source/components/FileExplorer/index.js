// components/FileExplorer/index.js
import React, { useState, useEffect } from 'react';
import { Box, Text, useStdout } from 'ink';
import FileList from './FileList.js';
import FilePreview from './FilePreview.js';
import NavigationHelp from './NavigationHelp.js';
import { FileExplorerProvider, useFileExplorer } from '../../contexts/FileExplorerContext.js';
import useKeymap from '../../hooks/useKeymap.js';

// Direct import for 'open' package
import open from 'open';

const FileExplorerContent = ({ mode = 'browse', multiSelect = false }) => {
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
    navigateToParent,
    navigateToDirectory,
    goBack,
    selectFile,
    toggleFileSelection,
    openFileInExplorer,
    previewScrollOffset,
    setPreviewScrollOffset,
    selectedFiles,
    error
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

  // Define keymap handlers
  const handlers = {
    navigateUp: () => {
      // If at the first item, wrap around to the last item (-1 is parent directory)
      const newIndex = selectedIndex <= -1
        ? files.length - 1
        : Math.max(-1, selectedIndex - 1);

      setSelectedIndex(newIndex);

      // Update visible window if selection would go out of view
      if (newIndex < visibleStartIndex) {
        // If wrapping to the end, show the last page
        if (selectedIndex <= -1 && files.length > MAX_VISIBLE_FILES) {
          setVisibleStartIndex(Math.max(0, files.length - MAX_VISIBLE_FILES));
        } else {
          setVisibleStartIndex(Math.max(0, newIndex));
        }
      }
    },
    navigateDown: () => {
      // If at the last item, wrap around to parent directory or first item
      const newIndex = selectedIndex >= files.length - 1
        ? -1
        : Math.min(files.length - 1, selectedIndex + 1);

      setSelectedIndex(newIndex);

      // Update visible window if selection would go out of view
      if (newIndex === -1) {
        // When wrapping to the top, always show from the beginning
        setVisibleStartIndex(0);
      } else if (newIndex >= visibleStartIndex + MAX_VISIBLE_FILES) {
        setVisibleStartIndex(newIndex - MAX_VISIBLE_FILES + 1);
      }
    },
    pageUp: () => {
      // Page up: move selection up by page size
      const newIndex = Math.max(-1, selectedIndex - MAX_VISIBLE_FILES);
      setSelectedIndex(newIndex);
      setVisibleStartIndex(Math.max(0, newIndex - Math.floor(MAX_VISIBLE_FILES / 2)));
    },
    pageDown: () => {
      // Page down: move selection down by page size
      const newIndex = Math.min(files.length - 1, selectedIndex + MAX_VISIBLE_FILES);
      setSelectedIndex(newIndex);
      setVisibleStartIndex(Math.max(0, Math.min(
        files.length - MAX_VISIBLE_FILES,
        newIndex - Math.floor(MAX_VISIBLE_FILES / 2)
      )));
    },
    openDir: () => {
      if (selectedIndex === -1) {
        // Go to parent directory when ".." is selected
        navigateToParent();
      } else if (files[selectedIndex]) {
        if (files[selectedIndex].isDirectory) {
          navigateToDirectory(files[selectedIndex]);
        } else if (mode === 'picker') {
          if (multiSelect) {
            // In multiselect mode, Enter confirms all selected files
            if (selectedFiles.length > 0) {
              selectFile(files[selectedIndex]);
            }
          } else {
            // In single picker mode, Enter selects the file
            selectFile(files[selectedIndex]);
          }
        }
      }
    },
    parentDir: () => navigateToParent(),
    goBack: () => goBack(),
    previewScrollUp: () => {
      const content = files[selectedIndex] ? files[selectedIndex].content : '';
      const totalLines = content ? content.split('\n').length : 0;
      setPreviewScrollOffset(Math.max(0, previewScrollOffset - 1));
    },
    previewScrollDown: () => {
      const content = files[selectedIndex] ? files[selectedIndex].content : '';
      const totalLines = content ? content.split('\n').length : 0;
      setPreviewScrollOffset(Math.min(
        Math.max(0, totalLines - MAX_VISIBLE_FILES),
        previewScrollOffset + 1
      ));
    },
    openFile: () => handleOpenFile(),
    pickFile: () => {
      if (mode === 'browse' && selectedIndex >= 0 && files[selectedIndex] && !files[selectedIndex].isDirectory) {
        selectFile(files[selectedIndex]);
      }
    },
    toggleSelection: () => {
      if (multiSelect && selectedIndex >= 0 && files[selectedIndex]) {
        toggleFileSelection(files[selectedIndex]);
      }
    },
    exit: () => goBack()
  };

  // Use the keymap hook
  useKeymap('fileExplorer', handlers, { isActive: true });

  // Get the currently selected file
  const selectedFile = selectedIndex >= 0 ? files[selectedIndex] : undefined;

  return (
    <Box
      flexDirection="column"
      width={terminalWidth}
      height={terminalHeight}
    >
      <Box alignSelf="end" width={terminalWidth} paddingX={1}>
        <Text flexGrow={1} bold wrap="truncate">
          File Explorer {mode === 'picker' ? (multiSelect ? 'SPACE select | ENTER confirm' : '(Select a file)') : ''}
        </Text>
      </Box>

      <Box flexGrow={1} width={terminalWidth} paddingX={1}>
        <Text wrap="truncate">Path: <Text color="blue">{
          currentPath.length > terminalWidth - 10
            ? '...' + currentPath.substring(currentPath.length - (terminalWidth - 10))
            : currentPath
        }</Text></Text>
      </Box>

      {multiSelect && (
        <Box width={terminalWidth} paddingX={1}>
          <Text color="green">
            Selected: {selectedFiles?.length || 0} file{(selectedFiles?.length || 0) !== 1 ? 's' : ''}
          </Text>
        </Box>
      )}

      {error ? (
        <Box width={terminalWidth} paddingX={1}>
          <Text color="red" wrap="truncate">{error}</Text>
        </Box>
      ) : (
        <Box height={terminalHeight - (multiSelect ? 11 : 10)} paddingX={1}>
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
        <NavigationHelp
          width={terminalWidth}
          showPickOption={mode === 'browse'}
          showMultiSelectOption={multiSelect}
        />
      </Box>
    </Box>
  );
};

const FileExplorer = ({
  initialPath,
  onBack,
  onFileSelect,
  mode = 'browse', // 'browse' or 'picker'
  multiSelect = false
}) => {
  return (
    <FileExplorerProvider
      initialPath={initialPath}
      onFileSelect={onFileSelect}
      onBack={onBack}
      multiSelect={multiSelect}
    >
      <FileExplorerContent mode={mode} multiSelect={multiSelect} />
    </FileExplorerProvider>
  );
};

export default FileExplorer;
