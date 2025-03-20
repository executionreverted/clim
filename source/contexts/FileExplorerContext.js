import React, { createContext, useContext, useState, useEffect } from 'react';
import path from 'path';
import fs from 'fs';
import { loadDirectory } from '../components/FileExplorer/utils.js';

const FileExplorerContext = createContext();

export const useFileExplorer = () => useContext(FileExplorerContext);

export const FileExplorerProvider = ({ children, initialPath, onFileSelect, onBack }) => {
  const [currentPath, setCurrentPath] = useState(initialPath || process.cwd());
  const [files, setFiles] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [visibleStartIndex, setVisibleStartIndex] = useState(0);
  const [error, setError] = useState('');
  const [previewScrollOffset, setPreviewScrollOffset] = useState(0);
  const [history, setHistory] = useState([]);

  // Load directory contents on path change
  useEffect(() => {
    loadDirectory(currentPath, setFiles, setSelectedIndex, setError, setVisibleStartIndex);
    // Start with ".." selected
    setSelectedIndex(-1);
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
    if (onFileSelect && file && !file.isDirectory) {
      onFileSelect(file);
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
      }}
    >
      {children}
    </FileExplorerContext.Provider>
  );
};

export default FileExplorerContext;
