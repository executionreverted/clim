// source/contexts/RoomBaseChatContext.js - Updated for Hyperblobs
import React, { useState, createContext, useContext, useReducer, useCallback } from 'react';
import { getBindingsForContext } from '../utils/keymap.js';
import { useRoomBase } from './RoomBaseContext.js';
import clipboardy from 'clipboardy';
import path from 'path';
import { writeFileSync } from 'fs';

// Define action types
const ACTIONS = {
  SET_INPUT_VALUE: 'SET_INPUT_VALUE',
  SET_FOCUSED_PANEL: 'SET_FOCUSED_PANEL',
  SET_INPUT_MODE: 'SET_INPUT_MODE',
  SET_SHOW_FILE_EXPLORER: 'SET_SHOW_FILE_EXPLORER',
  SET_FILE_ATTACHMENTS: 'SET_FILE_ATTACHMENTS',
  SET_SHOW_ROOM_FILES: 'SET_SHOW_ROOM_FILES',
  SET_LOADING: 'SET_LOADING',
  SET_LOADING_MESSAGE: 'SET_LOADING_MESSAGE'
};

// Configuration
const MAX_MESSAGE_LENGTH = 10000; // Maximum length for a single message

// Initial state
const initialState = {
  inputValue: '',
  focusedPanel: 'messages', // 'rooms', 'messages', 'users', 'input'
  inputMode: false,
  showFileExplorer: false,
  pendingAttachments: null,
  showRoomFiles: false,
  isLoading: false,
  loadingMessage: ''
};

// Chat reducer
const chatReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.SET_INPUT_VALUE:
      // Limit input length to prevent memory issues
      const truncatedInput = typeof action.payload === 'string' &&
        action.payload.length > MAX_MESSAGE_LENGTH ?
        action.payload.substring(0, MAX_MESSAGE_LENGTH) :
        action.payload;

      return {
        ...state,
        inputValue: truncatedInput
      };

    case ACTIONS.SET_FOCUSED_PANEL:
      return {
        ...state,
        focusedPanel: action.payload
      };

    case ACTIONS.SET_INPUT_MODE:
      return {
        ...state,
        inputMode: action.payload
      };

    case ACTIONS.SET_SHOW_FILE_EXPLORER:
      return {
        ...state,
        showFileExplorer: action.payload,
        // Make sure we don't show both at once
        showRoomFiles: action.payload ? false : state.showRoomFiles
      };

    case ACTIONS.SET_FILE_ATTACHMENTS:
      return {
        ...state,
        showFileExplorer: false,
        pendingAttachments: action.payload
      };

    case ACTIONS.SET_SHOW_ROOM_FILES:
      return {
        ...state,
        showRoomFiles: action.payload,
        // Make sure we don't show both at once
        showFileExplorer: action.payload ? false : state.showFileExplorer
      };

    case ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload
      };

    case ACTIONS.SET_LOADING_MESSAGE:
      return {
        ...state,
        loadingMessage: action.payload
      };

    default:
      return state;
  }
};

const RoomBaseChatContext = createContext();

export const useChat = () => useContext(RoomBaseChatContext);

export const RoomBaseChatProvider = ({ children, onBack }) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  // Use the RoomBase context
  const {
    rooms,
    activeRoom,
    activeRoomId,
    setActiveRoom,
    createRoom,
    joinRoom,
    leaveRoom,
    sendMessage,
    peers,
    createInviteCode,
    updateProfile,
    identity,
    connections,
    loadMoreMessages,
    messageCounts,

    files,
    fileLoading,
    currentDirectory,
    loadRoomFiles,
    uploadFile,
    downloadFile,
    deleteFile,
    createDirectory,
    navigateDirectory,

    TEMP,
    downloading
  } = useRoomBase();

  const {
    inputValue,
    focusedPanel,
    inputMode,
    showFileExplorer,
    showRoomFiles,
    isLoading,
    loadingMessage
  } = state;

  // Get chat keybindings for reference
  const chatBindings = getBindingsForContext('chat');

  // Action creators (memoized for performance)
  const setInputValue = useCallback((value) => {
    dispatch({ type: ACTIONS.SET_INPUT_VALUE, payload: value });
  }, []);

  const setFocusedPanel = useCallback((panel) => {
    dispatch({ type: ACTIONS.SET_FOCUSED_PANEL, payload: panel });
  }, []);

  const setInputMode = useCallback((mode) => {
    dispatch({ type: ACTIONS.SET_INPUT_MODE, payload: mode });
  }, []);

  const setShowFileExplorer = useCallback((show) => {
    dispatch({ type: ACTIONS.SET_SHOW_FILE_EXPLORER, payload: show });
  }, []);

  const setShowRoomFiles = useCallback((show) => {
    dispatch({ type: ACTIONS.SET_SHOW_ROOM_FILES, payload: show });
  }, []);

  const setLoading = useCallback((loading, message = '') => {
    dispatch({ type: ACTIONS.SET_LOADING, payload: loading });
    if (message) {
      dispatch({ type: ACTIONS.SET_LOADING_MESSAGE, payload: message });
    }
  }, []);

  // Safely prepare file loading with error handling
  const safeLoadRoomFiles = useCallback(async (roomId, path) => {
    if (!roomId) return false;

    try {
      setLoading(true, 'Loading files...');
      await loadRoomFiles(roomId, path);
      return true;
    } catch (err) {
      console.error(`Error loading files for room ${roomId}:`, err);
      writeFileSync('./loadfiles', JSON.stringify(err.message))
      if (activeRoomId) {
        sendMessage(
          activeRoomId,
          `Error loading files: ${err.message}`,
          true
        );
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, [activeRoomId, loadRoomFiles, sendMessage, setLoading]);

  // Handle input submission
  const handleInputSubmit = useCallback((localInputVal) => {
    if (!localInputVal || !localInputVal.trim()) return true;

    // Check for the /files command first
    if (localInputVal.trim() === '/files') {
      setInputValue('');
      setInputMode(false);

      if (activeRoomId) {
        // Load files before showing the file browser UI
        safeLoadRoomFiles(activeRoomId, currentDirectory[activeRoomId] || '/')
          .then(success => {
            if (success) {
              setShowRoomFiles(true);
            }
          });
      }
      return true;
    }

    // Check for commands first
    if (localInputVal.trim() === '/send') {
      setInputValue('');
      setShowFileExplorer(true);
      return true;
    }

    if (localInputVal.trim() === '/clear') {
      setInputValue('');
      // Clearing history isn't implemented in RoomBaseContext yet
      return true;
    }

    if (localInputVal.trim().startsWith('/join ')) {
      const inviteCode = localInputVal.replace("/join ", "").trim();

      if (inviteCode) {
        setLoading(true, 'Joining room...');
        joinRoom(inviteCode)
          .then(() => {
            setInputMode(false);
          })
          .catch(err => {
            console.error('Error joining room:', err);
            if (activeRoomId) {
              sendMessage(
                activeRoomId,
                `Error joining room: ${err.message}`,
                true
              );
            }
          })
          .finally(() => {
            setLoading(false);
          });

        setInputValue('');
      }
      return true;
    }

    if (localInputVal.trim().startsWith('/create ')) {
      const roomName = localInputVal.trim().substring(8);
      if (roomName) {
        setLoading(true, 'Creating room...');
        createRoom(roomName)
          .then(() => {
            setInputMode(false);
          })
          .catch(err => {
            console.error('Error creating room:', err);
            if (activeRoomId) {
              sendMessage(
                activeRoomId,
                `Error creating room: ${err.message}`,
                true
              );
            }
          })
          .finally(() => {
            setLoading(false);
          });

        setInputValue('');
      }
      return true;
    }

    if (localInputVal.trim() === '/leave' && activeRoomId) {
      leaveRoom(activeRoomId)
        .catch(err => {
          console.error('Error leaving room:', err);
        });

      setInputValue('');
      return true;
    }

    if (localInputVal.trim().startsWith('/profile ')) {
      const username = localInputVal.trim().substring(9);
      if (username) {
        setLoading(true, 'Updating profile...');
        updateProfile(username)
          .then(success => {
            if (success && activeRoomId) {
              // Send system message confirming profile update
              sendMessage(
                activeRoomId,
                `Your username has been updated to "${username}"`,
                true
              );
            }
          })
          .catch(err => {
            console.error('Error updating profile:', err);
          })
          .finally(() => {
            setLoading(false);
          });

        setInputValue('');
      }
      return true;
    }

    if (localInputVal.trim() === '/invite' && activeRoomId) {
      setLoading(true, 'Creating invite...');
      createInviteCode(activeRoomId)
        .then(inviteCode => {
          if (inviteCode) {
            try {
              // Copy to clipboard
              clipboardy.writeSync(`/join ${inviteCode}`);

              // Display a message to the user
              sendMessage(
                activeRoomId,
                `Invite code copied to clipboard! Others can join using "/join ${inviteCode}"`,
                true
              );
            } catch (clipErr) {
              // If clipboard fails, just show the code
              sendMessage(
                activeRoomId,
                `Invite code: ${inviteCode}. Share this with others to join.`,
                true
              );
            }
          }
        })
        .catch(err => {
          console.error('Error creating invite:', err);

          if (activeRoomId) {
            sendMessage(
              activeRoomId,
              `Error creating invite: ${err.message}`,
              true
            );
          }
        })
        .finally(() => {
          setLoading(false);
        });

      setInputValue('');
      return true;
    }

    if (focusedPanel === 'rooms' && inputMode) {
      // Create room if in rooms panel and input mode
      if (localInputVal.trim()) {
        setLoading(true, 'Creating room...');
        createRoom(localInputVal)
          .then(() => {
            setInputMode(false);
          })
          .catch(err => {
            console.error('Error creating room:', err);
          })
          .finally(() => {
            setLoading(false);
          });

        setInputValue('');
      }
      return true;
    } else if ((focusedPanel === 'messages' || focusedPanel === 'input') && localInputVal.trim()) {
      if (activeRoomId) {
        // Store the current input value
        const messageToSend = localInputVal;

        // Clear input first to prevent re-submissions
        setInputValue('');

        // Then send the message using RoomBaseContext
        sendMessage(activeRoomId, messageToSend)
          .catch(err => {
            console.error('Error sending message:', err);
          });

        return true;
      }
    }

    return false;
  }, [
    focusedPanel,
    inputMode,
    activeRoomId,
    sendMessage,
    createRoom,
    joinRoom,
    leaveRoom,
    createInviteCode,
    updateProfile,
    currentDirectory
  ]);

  // Handle file selection for message attachments
  const handleFileSelect = useCallback((files) => {
    if (!files || (Array.isArray(files) && files.length === 0)) {
      setShowFileExplorer(false);
      return;
    }

    // Check if we have an active room to send files to
    if (!activeRoomId) {
      console.error('No active room to send files to');
      setShowFileExplorer(false);
      return;
    }

    // Convert to array if single file
    const filesArray = Array.isArray(files) ? files : [files];

    setLoading(true, 'Uploading files...');
    setShowFileExplorer(false);

    // Upload files one by one to avoid memory issues
    const processFiles = async (index) => {
      if (index >= filesArray.length) {
        setLoading(false);
        return;
      }

      const file = filesArray[index];
      try {
        // Get file name from path or use as is
        const fileName = file.path ? path.basename(file.path) : (file.name || `file-${Date.now()}`);

        // Upload the file using RoomBaseContext's uploadFile
        await uploadFile(activeRoomId, file, fileName);

        // Upload next file
        processFiles(index + 1);
      } catch (err) {
        console.error(`Error uploading file ${file.name || 'unknown'}:`, err);

        // Show error message
        if (activeRoomId) {
          sendMessage(
            activeRoomId,
            `Error uploading file: ${err.message}`,
            true
          );
        }

        // Continue with next file
        processFiles(index + 1);
      }
    };

    // Start uploading files
    processFiles(0);
  }, [activeRoomId, uploadFile, setShowFileExplorer, setLoading, sendMessage]);

  const contextValue = {
    // From RoomBase context
    rooms,
    activeRoom,
    activeRoomId,
    setActiveRoomId: setActiveRoom,

    // Local state
    inputValue,
    setInputValue,
    focusedPanel,
    setFocusedPanel,
    inputMode,
    setInputMode,
    showRoomFiles,
    setShowRoomFiles,
    isLoading,
    loadingMessage,

    // Functions
    sendMessage,
    createRoom,
    joinRoom,
    leaveRoom,
    handleInputSubmit,
    showFileExplorer,
    setShowFileExplorer,
    handleFileSelect,
    loadMoreMessages,
    onBack,

    // Additional from RoomBase
    peers,
    identity,
    connections,
    roomConnections: connections, // For backward compatibility
    messageCounts,

    // File-related
    files,
    fileLoading,
    currentDirectory,
    loadRoomFiles,
    uploadFile,
    downloadFile,
    deleteFile,
    createDirectory,
    navigateDirectory,
    TEMP,
    downloading
  };

  return (
    <RoomBaseChatContext.Provider value={contextValue}>
      {children}
    </RoomBaseChatContext.Provider>
  );
};

export default RoomBaseChatContext;
