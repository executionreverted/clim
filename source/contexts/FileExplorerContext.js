import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import path from 'path';
import fs from 'fs';
import { loadDirectoryAsync } from '../components/FileExplorer/utils.js';

// Define action types
const ACTIONS = {
  SET_FILES: 'SET_FILES',
  SET_ERROR: 'SET_ERROR',
  SET_SELECTED_INDEX: 'SET_SELECTED_INDEX',
  SET_VISIBLE_START_INDEX: 'SET_VISIBLE_START_INDEX',
  SET_PREVIEW_SCROLL_OFFSET: 'SET_PREVIEW_SCROLL_OFFSET',
  NAVIGATE_TO_DIRECTORY: 'NAVIGATE_TO_DIRECTORY',
  NAVIGATE_TO_PARENT: 'NAVIGATE_TO_PARENT',
  GO_BACK: 'GO_BACK',
  TOGGLE_FILE_SELECTION: 'TOGGLE_FILE_SELECTION',
  CLEAR_SELECTED_FILES: 'CLEAR_SELECTED_FILES'
};

// Initial state
const initialState = (initialPath) => ({
  currentPath: initialPath || process.cwd(),
  files: [],
  selectedIndex: -1,
  visibleStartIndex: 0,
  error: '',
  previewScrollOffset: 0,
  history: [],
  selectedFiles: []
});

// Reducer function
const fileExplorerReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.SET_FILES:
      return { ...state, files: action.payload };

    case ACTIONS.SET_ERROR:
      return { ...state, error: action.payload };

    case ACTIONS.SET_SELECTED_INDEX:
      return { ...state, selectedIndex: action.payload };

    case ACTIONS.SET_VISIBLE_START_INDEX:
      return { ...state, visibleStartIndex: action.payload };

    case ACTIONS.SET_PREVIEW_SCROLL_OFFSET:
      return { ...state, previewScrollOffset: action.payload };

    case ACTIONS.NAVIGATE_TO_DIRECTORY:
      return {
        ...state,
        currentPath: action.payload,
        history: [...state.history, state.currentPath],
        // Reset preview and selection when changing directory
        previewScrollOffset: 0,
        selectedFiles: []
      };

    case ACTIONS.NAVIGATE_TO_PARENT:
      const parentPath = path.dirname(state.currentPath);
      if (parentPath === state.currentPath) return state;
      return {
        ...state,
        currentPath: parentPath,
        history: [...state.history, state.currentPath],
        previewScrollOffset: 0,
        selectedFiles: []
      };

    case ACTIONS.GO_BACK:
      if (state.history.length === 0) return state;
      const newHistory = [...state.history];
      const prevPath = newHistory.pop();
      return {
        ...state,
        currentPath: prevPath,
        history: newHistory,
        previewScrollOffset: 0,
        selectedFiles: []
      };

    case ACTIONS.TOGGLE_FILE_SELECTION:
      const file = action.payload;
      const isAlreadySelected = state.selectedFiles.some(f => f.path === file.path);

      if (isAlreadySelected) {
        return {
          ...state,
          selectedFiles: state.selectedFiles.filter(f => f.path !== file.path)
        };
      } else {
        return {
          ...state,
          selectedFiles: [...state.selectedFiles, file]
        };
      }

    case ACTIONS.CLEAR_SELECTED_FILES:
      return { ...state, selectedFiles: [] };

    default:
      return state;
  }
};

const FileExplorerContext = createContext();

export const useFileExplorer = () => useContext(FileExplorerContext);

export const FileExplorerProvider = ({ children, initialPath, onFileSelect, onBack, multiSelect = false }) => {
  const [state, dispatch] = useReducer(fileExplorerReducer, initialState(initialPath));

  const {
    currentPath,
    files,
    selectedIndex,
    visibleStartIndex,
    error,
    previewScrollOffset,
    selectedFiles
  } = state;

  // Load directory contents on path change
  useEffect(() => {
    const loadDir = async () => {
      try {
        const sortedItems = await loadDirectoryAsync(currentPath)

        dispatch({ type: ACTIONS.SET_FILES, payload: sortedItems });
        dispatch({ type: ACTIONS.SET_SELECTED_INDEX, payload: -1 });
        dispatch({ type: ACTIONS.SET_VISIBLE_START_INDEX, payload: 0 });
        dispatch({ type: ACTIONS.SET_ERROR, payload: '' });
      } catch (err) {
        dispatch({ type: ACTIONS.SET_ERROR, payload: `Error: ${err.message}` });
        dispatch({ type: ACTIONS.SET_FILES, payload: [] });
      }
    };

    loadDir();
  }, [currentPath]);

  // Reset preview scroll when selecting a different file
  useEffect(() => {
    dispatch({ type: ACTIONS.SET_PREVIEW_SCROLL_OFFSET, payload: 0 });
  }, [selectedIndex]);

  // Memoized action dispatchers
  const setSelectedIndex = useCallback((index) => {
    dispatch({ type: ACTIONS.SET_SELECTED_INDEX, payload: index });
  }, []);

  const setVisibleStartIndex = useCallback((index) => {
    dispatch({ type: ACTIONS.SET_VISIBLE_START_INDEX, payload: index });
  }, []);

  const setPreviewScrollOffset = useCallback((offset) => {
    dispatch({ type: ACTIONS.SET_PREVIEW_SCROLL_OFFSET, payload: offset });
  }, []);

  const navigateToParent = useCallback(() => {
    dispatch({ type: ACTIONS.NAVIGATE_TO_PARENT });
  }, []);

  const navigateToDirectory = useCallback((item) => {
    if (item.isDirectory) {
      dispatch({ type: ACTIONS.NAVIGATE_TO_DIRECTORY, payload: item.path });
    }
  }, []);

  const goBack = useCallback(() => {
    if (state.history.length > 0) {
      dispatch({ type: ACTIONS.GO_BACK });
    } else if (onBack) {
      onBack();
    }
  }, [state.history.length, onBack]);

  const selectFile = useCallback((file) => {
    if (onFileSelect) {
      if (multiSelect) {
        onFileSelect(selectedFiles);
      } else if (file && !file.isDirectory) {
        onFileSelect(file);
      }
    }
  }, [multiSelect, onFileSelect, selectedFiles]);

  const toggleFileSelection = useCallback((file) => {
    if (!file || file.isDirectory) return;
    dispatch({ type: ACTIONS.TOGGLE_FILE_SELECTION, payload: file });
  }, []);

  const openFileInExplorer = useCallback(async (file) => {
    if (file) {
      try {
        // This will be implemented with the 'open' package in the actual component
        const open = (await import('open')).default;
        await open(file.path);
      } catch (err) {
        dispatch({ type: ACTIONS.SET_ERROR, payload: `Failed to open file: ${err.message}` });
      }
    }
  }, []);

  const contextValue = {
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
  };

  return (
    <FileExplorerContext.Provider value={contextValue}>
      {children}
    </FileExplorerContext.Provider>
  );
};

export default FileExplorerContext;
