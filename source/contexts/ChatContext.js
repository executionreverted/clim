// contexts/ChatContext.js - Updated to use RoomBaseContext
import React, { useRef, useEffect, createContext, useContext, useReducer, useCallback } from 'react';
import { matchesKeyBinding, getBindingsForContext } from '../utils/keymap.js';
import { useRoomBase } from './RoomBaseContext.js';

// Define action types
const ACTIONS = {
  SET_INPUT_VALUE: 'SET_INPUT_VALUE',
  SET_FOCUSED_PANEL: 'SET_FOCUSED_PANEL',
  SET_INPUT_MODE: 'SET_INPUT_MODE',
  SET_SHOW_FILE_EXPLORER: 'SET_SHOW_FILE_EXPLORER',
  SET_FILE_ATTACHMENTS: 'SET_FILE_ATTACHMENTS',
};

// Configuration
const MAX_MESSAGE_LENGTH = 10000; // Maximum length for a single message

// Initial state
const initialState = {
  inputValue: '',
  focusedPanel: 'messages', // 'rooms', 'messages', 'users', 'input'
  inputMode: false,
  showFileExplorer: false,
  pendingAttachments: null
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
        showFileExplorer: action.payload
      };

    case ACTIONS.SET_FILE_ATTACHMENTS:
      return {
        ...state,
        showFileExplorer: false,
        pendingAttachments: action.payload
      };

    default:
      return state;
  }
};

const ChatContext = createContext();

export const useChat = () => useContext(ChatContext);

export const ChatProvider = ({ children, onBack }) => {
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
    connections,
    createInviteCode,
    updateProfile,
    identity
  } = useRoomBase();

  // Add this at the top of the ChatProvider function:
  const lastMessageRef = useRef(null);

  const {
    inputValue,
    focusedPanel,
    inputMode,
    showFileExplorer
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

  // Handle input submission
  const handleInputSubmit = useCallback((localInputVal) => {
    if (!localInputVal || !localInputVal.trim()) return true;

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
      const roomName = localInputVal.trim().substring(6);
      if (roomName) {
        joinRoom(roomName);
        setInputValue('');
        setInputMode(false);
      }
      return true;
    }

    if (localInputVal.trim().startsWith('/create ')) {
      const roomName = localInputVal.trim().substring(8);
      if (roomName) {
        createRoom(roomName);
        setInputValue('');
        setInputMode(false);
      }
      return true;
    }

    if (localInputVal.trim() === '/leave' && activeRoomId) {
      leaveRoom(activeRoomId);
      setInputValue('');
      return true;
    }

    if (localInputVal.trim().startsWith('/profile ')) {
      const username = localInputVal.trim().substring(9);
      if (username) {
        updateProfile(username);
        if (success) {
          setInputValue('');
        }
      }
      return true;
    }

    if (localInputVal.trim() === '/invite' && activeRoomId) {
      createInviteCode(activeRoomId).then(inviteCode => {
        if (inviteCode) {
          // Display a message to the user that the invite was copied
          sendMessage(
            activeRoomId,
            `Invite code created: ${inviteCode}\nOthers can join using "/join ${inviteCode}"`,
            true
          );
        }
      }).catch(err => {
        sendMessage(activeRoomId, `Error creating invite: ${err.message}`, true);
      });

      setInputValue('');
      return true;
    }

    if (focusedPanel === 'rooms' && inputMode) {
      // Create room if in rooms panel and input mode
      if (localInputVal.trim()) {
        createRoom(localInputVal);
        setInputMode(false);
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
        sendMessage(activeRoomId, messageToSend);
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
    setInputValue,
    createInviteCode,
    updateProfile
  ]);

  // Handle file selection for message attachments
  const handleFileSelect = useCallback((files) => {
    if (!files || (Array.isArray(files) && files.length === 0)) {
      dispatch({
        type: ACTIONS.SET_SHOW_FILE_EXPLORER,
        payload: false
      });
      return;
    }

    // Check if we have an active room to send files to
    if (!activeRoomId) {
      console.error('No active room to send files to');
      dispatch({
        type: ACTIONS.SET_SHOW_FILE_EXPLORER,
        payload: false
      });
      return;
    }

    // Convert to array if single file
    const filesArray = Array.isArray(files) ? files : [files];

    // Create the message for file(s)
    const totalSize = filesArray.reduce((sum, file) => sum + file.size, 0);
    let messageText;

    if (filesArray.length === 1) {
      // Single file message
      const file = filesArray[0];
      messageText = `📎 Shared file: ${file.name} (${file.size} bytes)`;
    } else {
      // Multiple files message
      messageText = `📎 Shared ${filesArray.length} files (${Math.round(totalSize / 1024)} KB total)\n`;
      filesArray.forEach((file, index) => {
        messageText += `\n${index + 1}. ${file.name} (${file.size} bytes)`;
      });
    }

    // Send the message using RoomBaseContext
    if (activeRoomId) {
      sendMessage(activeRoomId, messageText);
    }

    // Close file explorer
    dispatch({
      type: ACTIONS.SET_SHOW_FILE_EXPLORER,
      payload: false
    });
  }, [activeRoomId, sendMessage]);

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

    // Functions
    sendMessage,
    createRoom,
    joinRoom,
    leaveRoom,
    handleInputSubmit,
    showFileExplorer,
    setShowFileExplorer,
    handleFileSelect,
    onBack,

    // Additional from RoomBase
    peers,
    identity,
    connections
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
};

export default ChatContext;
