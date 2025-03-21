// contexts/ChatContext.js - Optimized with memory management
import React, { useRef, useEffect, createContext, useContext, useReducer, useCallback, useMemo } from 'react';
import { matchesKeyBinding, getBindingsForContext } from '../utils/keymap.js';

// Define action types
const ACTIONS = {
  SET_ACTIVE_ROOM: 'SET_ACTIVE_ROOM',
  ADD_ROOM: 'ADD_ROOM',
  SET_INPUT_VALUE: 'SET_INPUT_VALUE',
  SET_FOCUSED_PANEL: 'SET_FOCUSED_PANEL',
  SET_INPUT_MODE: 'SET_INPUT_MODE',
  SEND_MESSAGE: 'SEND_MESSAGE',
  SET_SHOW_FILE_EXPLORER: 'SET_SHOW_FILE_EXPLORER',
  SET_FILE_ATTACHMENTS: 'SET_FILE_ATTACHMENTS',
  CLEAR_HISTORY: 'CLEAR_HISTORY',
  PRUNE_MESSAGES: 'PRUNE_MESSAGES'
};

// Configuration
const MAX_MESSAGES_PER_ROOM = 100; // Limit messages to prevent memory issues
const MAX_MESSAGE_LENGTH = 10000; // Maximum length for a single message

// Mock data for demo with multiline messages
const MOCK_ROOMS = [
  { id: '1', name: 'General', messages: [], users: ['Alice', 'Bob', 'Charlie'] },
  { id: '2', name: 'Support', messages: [], users: ['Dave', 'Eve', 'Support Bot'] },
  { id: '3', name: 'Random', messages: [], users: ['Frank', 'Grace', 'Heidi'] },
];

// Generate some mock messages including multiline ones
MOCK_ROOMS.forEach(room => {
  const users = [...room.users];
  const messageCount = 10 + Math.floor(Math.random() * 20);

  for (let i = 0; i < messageCount; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    const timestamp = new Date(Date.now() - (messageCount - i) * 1000 * 60 * 5);

    // Make some messages multiline
    let messageText;
    if (i % 5 === 0) {
      messageText = `This is a multiline message from ${user}.\nIt contains several paragraphs.\nEach paragraph is on its own line.\nThis demonstrates the multiline capability.`;
    } else if (i % 7 === 0) {
      // Create a message with a really long line that needs wrapping
      messageText = `This is a really long message that should wrap properly when displayed in the terminal. It's important that our chat app can handle these types of messages gracefully without breaking the UI layout. Users often paste content from other sources that contains long lines.`;
    } else {
      messageText = `This is a message from ${user} in ${room.name} room. Message #${i + 1}`;
    }

    room.messages.push({
      id: `${room.id}-msg-${i}`,
      user,
      text: messageText,
      timestamp
    });
  }
});

// Initial state
const initialState = {
  rooms: MOCK_ROOMS,
  activeRoomId: MOCK_ROOMS[0].id,
  inputValue: '',
  focusedPanel: 'messages', // 'rooms', 'messages', 'users', 'input'
  inputMode: false,
  showFileExplorer: false,
  pendingAttachments: null
};

// Helper function to truncate messages if they exceed the limit
const pruneRoomMessages = (room) => {
  if (room.messages.length > MAX_MESSAGES_PER_ROOM) {
    // Keep only the most recent messages
    const newMessages = room.messages.slice(-MAX_MESSAGES_PER_ROOM);
    return { ...room, messages: newMessages };
  }
  return room;
};

// Chat reducer
const chatReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.SET_ACTIVE_ROOM:
      return {
        ...state,
        activeRoomId: action.payload
      };

    case ACTIONS.ADD_ROOM:
      const newRoom = {
        id: `room-${Date.now()}`,
        name: action.payload,
        messages: [],
        users: ['You']
      };
      return {
        ...state,
        rooms: [...state.rooms, newRoom],
        activeRoomId: newRoom.id
      };

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

    case ACTIONS.SEND_MESSAGE:
      const { text, roomId } = action.payload;
      const newMessage = {
        id: `${roomId}-msg-${Date.now()}`,
        user: 'You',
        text,
        timestamp: new Date()
      };

      const updatedRooms = state.rooms.map(room => {
        if (room.id === roomId) {
          const updatedRoom = {
            ...room,
            messages: [...room.messages, newMessage]
          };
          // Prune messages if needed
          return pruneRoomMessages(updatedRoom);
        }
        return room;
      });

      return {
        ...state,
        rooms: updatedRooms,
        inputValue: ''
      };

    case ACTIONS.SET_SHOW_FILE_EXPLORER:
      return {
        ...state,
        showFileExplorer: action.payload
      };

    case ACTIONS.SET_FILE_ATTACHMENTS:
      const { files, roomId: targetRoomId } = action.payload;

      // If no files, just return current state
      if (!files || (Array.isArray(files) && files.length === 0)) {
        return {
          ...state,
          showFileExplorer: false
        };
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

      // Create the file message
      const fileMessage = {
        id: `${targetRoomId}-msg-${Date.now()}`,
        user: 'You',
        text: messageText,
        timestamp: new Date(),
        attachedFiles: filesArray.length === 1 ? undefined : filesArray,
        attachedFile: filesArray.length === 1 ? filesArray[0] : undefined
      };

      // Update rooms with the new message
      const roomsWithFile = state.rooms.map(room => {
        if (room.id === targetRoomId) {
          const updatedRoom = {
            ...room,
            messages: [...room.messages, fileMessage]
          };
          return pruneRoomMessages(updatedRoom);
        }
        return room;
      });

      return {
        ...state,
        rooms: roomsWithFile,
        showFileExplorer: false
      };

    case ACTIONS.CLEAR_HISTORY:
      // Clear all messages from specific room
      const clearedRooms = state.rooms.map(room => {
        if (room.id === roomId) {
          return { ...room, messages: [] };
        }
        return room;
      });

      return {
        ...state,
        rooms: clearedRooms
      };

    case ACTIONS.PRUNE_MESSAGES:
      // Prune messages from all rooms
      const prunedRooms = state.rooms.map(pruneRoomMessages);

      return {
        ...state,
        rooms: prunedRooms
      };

    default:
      return state;
  }
};

const ChatContext = createContext();

export const useChat = () => useContext(ChatContext);

export const ChatProvider = ({ children, onBack }) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  // Add this at the top of the ChatProvider function:
  const lastMessageRef = useRef(null);


  const {
    rooms,
    activeRoomId,
    inputValue,
    focusedPanel,
    inputMode,
    showFileExplorer
  } = state;

  // Memoize the active room
  const activeRoom = useMemo(() => {
    return rooms.find(room => room.id === activeRoomId) || rooms[0];
  }, [rooms, activeRoomId]);

  // Get chat keybindings for reference
  const chatBindings = useMemo(() => {
    return getBindingsForContext('chat');
  }, []);

  // Action creators (memoized for performance)
  const setActiveRoomId = useCallback((id) => {
    dispatch({ type: ACTIONS.SET_ACTIVE_ROOM, payload: id });
  }, []);

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

  // Fixed version of sendMessage in ChatContext.js
  const sendMessage = useCallback((text) => {
    if (!text || !text.trim()) return;

    // Use a ref to prevent duplicate submissions
    if (lastMessageRef.current === text) {
      console.log('Preventing duplicate message:', text);
      return;
    }

    // Store the message in the ref to prevent duplicates
    lastMessageRef.current = text;

    // Clear the ref after a short delay
    setTimeout(() => {
      if (lastMessageRef.current === text) {
        lastMessageRef.current = null;
      }
    }, 300);

    // Truncate very long messages
    let messageText = text;
    if (messageText.length > MAX_MESSAGE_LENGTH) {
      messageText = messageText.substring(0, MAX_MESSAGE_LENGTH) +
        '\n\n[Message truncated due to length]';
    }

    dispatch({
      type: ACTIONS.SEND_MESSAGE,
      payload: { text: messageText, roomId: activeRoomId }
    });
  }, [activeRoomId, dispatch]);
  // Update handleInputSubmit to prevent double submissions
  const handleInputSubmit = useCallback((localInputVal) => {
    if (localInputVal == "") return true;

    // Check for commands first
    if (localInputVal.trim() === '/send') {
      setInputValue('');
      setShowFileExplorer(true);
      return true;
    }

    if (localInputVal.trim() === '/clear') {
      setInputValue('');
      clearHistory();
      return true;
    }

    if (focusedPanel === 'rooms' && inputMode) {
      // Only create room if we have a name
      if (localInputVal.trim()) {
        createRoom(localInputVal);
        setInputMode(false);
        setInputValue('');
      }
      return true;
    } else if ((focusedPanel === 'messages' || focusedPanel === 'input') && localInputVal.trim()) {
      // Store the current input value to clear it
      const messageToSend = localInputVal;

      // Clear input first to prevent re-submissions
      setInputValue('');

      // Then send the message
      sendMessage(messageToSend);
      return true;
    }

    return false;
  }, [
    focusedPanel,
    inputMode,
    inputValue,
  ]);

  const createRoom = useCallback((name) => {
    if (!name.trim()) return;
    dispatch({ type: ACTIONS.ADD_ROOM, payload: name.trim() });
  }, []);

  const handleFileSelect = useCallback((files) => {
    dispatch({
      type: ACTIONS.SET_FILE_ATTACHMENTS,
      payload: { files, roomId: activeRoomId }
    });
  }, [activeRoomId]);

  const clearHistory = useCallback((roomId = activeRoomId) => {
    dispatch({ type: ACTIONS.CLEAR_HISTORY, payload: roomId });
  }, [activeRoomId]);

  const pruneMessages = useCallback(() => {
    dispatch({ type: ACTIONS.PRUNE_MESSAGES });
  }, []);

  // Set up automatic pruning of messages on a timer
  useEffect(() => {
    // Prune messages every 5 minutes to prevent memory issues
    const pruningInterval = setInterval(() => {
      pruneMessages();
    }, 5 * 60 * 1000);

    return () => clearInterval(pruningInterval);
  }, [pruneMessages]);

  const contextValue = {
    rooms,
    activeRoom,
    activeRoomId,
    setActiveRoomId,
    inputValue,
    setInputValue,
    focusedPanel,
    setFocusedPanel,
    inputMode,
    setInputMode,
    sendMessage,
    createRoom,
    handleInputSubmit,
    showFileExplorer,
    setShowFileExplorer,
    handleFileSelect,
    clearHistory,
    pruneMessages,
    onBack
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
};

export default ChatContext;
