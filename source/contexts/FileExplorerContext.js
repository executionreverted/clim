import React, { createContext, useContext, useState, useEffect } from 'react';
import path from 'path';
import fs from 'fs';
import { loadDirectory } from '../components/FileExplorer/utils.js';

const FileExplorerContext = createContext();

export const useFileExplorer = () => useContext(FileExplorerContext);

export const FileExplorerProvider = ({ children, initialPath, onFileSelect, onBack, multiSelect = false }) => {
  const [currentPath, setCurrentPath] = useState(initialPath || process.cwd());
  const [files, setFiles] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [visibleStartIndex, setVisibleStartIndex] = useState(0);
  const [error, setError] = useState('');
  const [previewScrollOffset, setPreviewScrollOffset] = useState(0);
  const [history, setHistory] = useState([]);

  // New state for multiselect
  const [selectedFiles, setSelectedFiles] = useState([]);

  // Load directory contents on path change
  useEffect(() => {
    loadDirectory(currentPath, setFiles, setSelectedIndex, setError, setVisibleStartIndex);
    // Start with ".." selected
    setSelectedIndex(-1);
    // Clear selected files when changing directory
    setSelectedFiles([]);
  }, [currentPath]);

  // Reset preview scroll when selecting a different file
  useEffect(() => {
    setPreviewScrollOffset(0);
  }, [selectedIndex]);

  const navigateToParent = () => {
    const parentPath = path.dirname(currentPath);
    if (parentPath !== currentPath) {
      // Add current path to history before navigating
      setHistory([...history, currentPath]);
      setCurrentPath(parentPath);
    }
  };

  const navigateToDirectory = (item) => {
    if (item.isDirectory) {
      // Add current path to history before navigating
      setHistory([...history, currentPath]);
      setCurrentPath(item.path);
    }
  };

  const goBack = () => {
    if (history.length > 0) {
      // Pop the last path from history
      const newHistory = [...history];
      const prevPath = newHistory.pop();
      setHistory(newHistory);
      setCurrentPath(prevPath);
    } else if (onBack) {
      // If no history but onBack provided, call it
      onBack();
    }
  };

  const selectFile = (file) => {
    if (onFileSelect) {
      if (multiSelect) {
        // In multiselect mode, return all selected files
        onFileSelect(selectedFiles);
      } else if (file && !file.isDirectory) {
        // In single select mode, return one file
        onFileSelect(file);
      }
    }
  };

  // Toggle selection of a file for multiselect
  const toggleFileSelection = (file) => {
    if (!file || file.isDirectory) return;

    const isAlreadySelected = selectedFiles.some(f => f.path === file.path);

    if (isAlreadySelected) {
      setSelectedFiles(selectedFiles.filter(f => f.path !== file.path));
    } else {
      setSelectedFiles([...selectedFiles, file]);
    }
  };

  const openFileInExplorer = async (file) => {
    if (file) {
      try {
        // This will be implemented with the 'open' package in the actual component
        console.log(`Opening file: ${file.path}`);
        // We'll implement this with dynamic import in the component
      } catch (err) {
        setError(`Failed to open file: ${err.message}`);
      }
    }
  };

  return (
    <FileExplorerContext.Provider
      value={{
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
        openFileInExplorer,
        multiSelect,
        selectedFiles,
        toggleFileSelection,
      }}
    >
      {children}
    </FileExplorerContext.Provider>
  );
};

export default FileExplorerContext;
