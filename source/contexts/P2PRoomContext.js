// src/contexts/P2PRoomContext.js - Enhanced with user identification
import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createHash } from 'crypto';
import Hyperswarm from 'hyperswarm';
import clipboardy from 'clipboardy';
import { randomBytes } from 'crypto';

// Configuration for file paths
const CONFIG_DIR = path.join(os.homedir(), '.config/.hyperchatters' + Math.floor(Math.random() * 1000));
const ROOMS_FILE = path.join(CONFIG_DIR, 'rooms.json');
const USERS_FILE = path.join(CONFIG_DIR, 'users.json');
const IDENTITY_FILE = path.join(CONFIG_DIR, 'identity.json');

// Create the context
const P2PRoomContext = createContext();

// Define action types
const ACTIONS = {
  SET_ROOMS: 'SET_ROOMS',
  SET_ACTIVE_ROOM: 'SET_ACTIVE_ROOM',
  ADD_ROOM: 'ADD_ROOM',
  REMOVE_ROOM: 'REMOVE_ROOM',
  ADD_MESSAGE: 'ADD_MESSAGE',
  SET_CONNECTING: 'SET_CONNECTING',
  SET_ERROR: 'SET_ERROR',
  SET_PEERS: 'SET_PEERS',
  UPDATE_ROOM_STATUS: 'UPDATE_ROOM_STATUS',
  SET_USERS: 'SET_USERS',
  UPDATE_USER: 'UPDATE_USER',
  SET_IDENTITY: 'SET_IDENTITY'
};

// Initial state
const initialState = {
  rooms: [],
  activeRoomId: null,
  connecting: false,
  error: null,
  peers: {},
  users: {},
  identity: null
};

// Reducer function
function reducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_ROOMS:
      return { ...state, rooms: action.payload };

    case ACTIONS.SET_ACTIVE_ROOM:
      return { ...state, activeRoomId: action.payload };

    case ACTIONS.ADD_ROOM:
      return {
        ...state,
        rooms: [...state.rooms, action.payload],
        activeRoomId: state.activeRoomId || action.payload.id
      };

    case ACTIONS.REMOVE_ROOM:
      return {
        ...state,
        rooms: state.rooms.filter(room => room.id !== action.payload),
        activeRoomId: state.activeRoomId === action.payload
          ? (state.rooms.length > 1 ? state.rooms.find(r => r.id !== action.payload)?.id : null)
          : state.activeRoomId
      };

    case ACTIONS.ADD_MESSAGE:
      return {
        ...state,
        rooms: state.rooms.map(room =>
          room.id === action.payload.roomId
            ? {
              ...room,
              messages: [...(room.messages || []), action.payload.message]
            }
            : room
        )
      };

    case ACTIONS.SET_CONNECTING:
      return { ...state, connecting: action.payload };

    case ACTIONS.SET_ERROR:
      return { ...state, error: action.payload };

    case ACTIONS.SET_PEERS:
      return {
        ...state,
        peers: {
          ...state.peers,
          [action.payload.roomId]: action.payload.count
        }
      };

    case ACTIONS.UPDATE_ROOM_STATUS:
      return {
        ...state,
        rooms: state.rooms.map(room =>
          room.id === action.payload.roomId
            ? { ...room, status: action.payload.status }
            : room
        )
      };

    case ACTIONS.SET_USERS:
      return { ...state, users: action.payload };

    case ACTIONS.UPDATE_USER:
      return {
        ...state,
        users: {
          ...state.users,
          [action.payload.publicKey]: action.payload.userData
        }
      };

    case ACTIONS.SET_IDENTITY:
      return { ...state, identity: action.payload };

    default:
      return state;
  }
}





// Helper function to create room topic from room ID
function createRoomTopic(roomId) {
  const hash = createHash('sha256');
  hash.update(roomId);
  return hash.digest().subarray(0, 32); // Hyperswarm needs a 32-byte topic
}

// Sanitize message content to prevent injection attacks
function sanitizeMessage(content) {
  if (!content) return '';

  // Convert to string if not already
  const str = typeof content === 'string' ? content : String(content);

  // Basic sanitization - strip HTML tags, control characters
  return str
    .replace(/<[^>]*>?/gm, '') // Remove HTML tags
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .trim();
}

// Create or load user identity
function loadOrCreateIdentity() {
  try {
    if (fs.existsSync(IDENTITY_FILE)) {
      return JSON.parse(fs.readFileSync(IDENTITY_FILE, 'utf-8'));
    }

    // Generate new keypair
    const publicKey = randomBytes(32).toString('hex');
    const privateKey = randomBytes(32).toString('hex');

    const identity = {
      publicKey,
      privateKey,
      username: `User_${publicKey.substring(0, 6)}`,
      createdAt: Date.now()
    };

    // Save identity
    fs.writeFileSync(IDENTITY_FILE, JSON.stringify(identity, null, 2));

    return identity;
  } catch (err) {
    throw new Error(`Failed to create/load identity: ${err.message}`);
  }
}

// Provider component
export function P2PRoomProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const swarmRefs = useRef(new Map());
  const peersRef = useRef({});

  // Ensure config directory exists and load identity
  useEffect(() => {
    try {
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }

      // Load or create user identity
      const identity = loadOrCreateIdentity();
      dispatch({ type: ACTIONS.SET_IDENTITY, payload: identity });

      // Load rooms
      if (!fs.existsSync(ROOMS_FILE)) {
        fs.writeFileSync(ROOMS_FILE, JSON.stringify([]));
      }

      // Load users
      if (!fs.existsSync(USERS_FILE)) {
        fs.writeFileSync(USERS_FILE, JSON.stringify({}));
      }

      const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      dispatch({ type: ACTIONS.SET_USERS, payload: users });

      // Load rooms
      const roomsData = JSON.parse(fs.readFileSync(ROOMS_FILE, 'utf-8'));

      // For each room, load its messages
      const roomsWithMessages = roomsData.map(room => {
        try {
          const roomFile = path.join(CONFIG_DIR, `${room.id}.json`);
          if (fs.existsSync(roomFile)) {
            const messages = JSON.parse(fs.readFileSync(roomFile, 'utf-8'));
            return { ...room, messages, status: 'connecting' };
          }
          return { ...room, messages: [], status: 'connecting' };
        } catch (err) {
          return { ...room, messages: [], status: 'error' };
        }
      });

      if (roomsWithMessages.length > 0) {
        dispatch({ type: ACTIONS.SET_ROOMS, payload: roomsWithMessages });
        dispatch({ type: ACTIONS.SET_ACTIVE_ROOM, payload: roomsWithMessages[0].id });
      }
    } catch (err) {
      dispatch({ type: ACTIONS.SET_ERROR, payload: `Initialization error: ${err.message}` });
    }
  }, []);

  // Initialize Hyperswarm for each room
  useEffect(() => {
    // Setup swarms for all rooms
    state.rooms.forEach(room => {
      if (!swarmRefs.current.has(room.id)) {
        initRoomSwarm(room);
      }
    });

    // Cleanup function to close swarms when component unmounts
    return () => {
      Array.from(swarmRefs.current.entries()).forEach(async ([roomId, swarm]) => {
        try {
          await swarm.destroy();
        } catch (err) {
          // Ignore destroy errors on unmount
        }
      });
      swarmRefs.current.clear();
    };
  }, [state.rooms.length, state.identity]);

  // Save rooms to disk whenever they change
  useEffect(() => {
    if (state.rooms.length > 0) {
      try {
        // Save room metadata without messages
        const roomsMetadata = state.rooms.map(({ messages, ...roomData }) => roomData);
        fs.writeFileSync(ROOMS_FILE, JSON.stringify(roomsMetadata, null, 2));

        // Save messages for each room in separate files
        state.rooms.forEach(room => {
          if (room.messages && room.messages.length > 0) {
            const roomFile = path.join(CONFIG_DIR, `${room.id}.json`);
            fs.writeFileSync(roomFile, JSON.stringify(room.messages, null, 2));
          }
        });
      } catch (err) {
        dispatch({ type: ACTIONS.SET_ERROR, payload: `Failed to save rooms: ${err.message}` });
      }
    }
  }, [state.rooms]);

  // Save users to disk when they change
  useEffect(() => {
    if (state.users && Object.keys(state.users).length > 0) {
      try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(state.users, null, 2));
      } catch (err) {
        dispatch({ type: ACTIONS.SET_ERROR, payload: `Failed to save users: ${err.message}` });
      }
    }
  }, [state.users]);


  useEffect(() => {
    // Define the cleanup function
    const cleanupSwarms = async () => {
      console.log(`Cleaning up ${swarmRefs.current.size} swarm connections...`);

      for (const [roomId, swarm] of swarmRefs.current.entries()) {
        try {
          console.log(`Closing swarm for room ${roomId}...`);
          await swarm.destroy();
          console.log(`Swarm for room ${roomId} closed successfully`);
        } catch (err) {
          console.error(`Error closing swarm for room ${roomId}:`, err.message);
        }
      }

      // Clear all references
      swarmRefs.current.clear();
      console.log('All swarm connections closed');
    };

    // Handle CTRL+C and other termination signals
    const handleExit = async () => {
      console.log('Application terminating, closing connections...');
      await cleanupSwarms();
      process.exit(0);
    };

    // Register the handlers
    process.on('SIGINT', handleExit);
    process.on('SIGTERM', handleExit);

    // Clean up event listeners when component unmounts
    return () => {
      process.removeListener('SIGINT', handleExit);
      process.removeListener('SIGTERM', handleExit);
    };
  }, []);



  // Handle incoming message and extract user info
  const processIncomingMessage = (roomId, data) => {
    try {
      const message = JSON.parse(data.toString());

      // Basic validation
      if (!message || !message.type) return;

      // Handle different message types
      switch (message.type) {
        case 'chat':
          // Process chat message
          if (message.content && message.sender && message.publicKey) {
            // Sanitize content and sender
            const sanitizedContent = sanitizeMessage(message.content);
            const senderKey = sanitizeMessage(message.publicKey);

            // Update or add user info
            const userData = state.users[senderKey] || {
              username: sanitizeMessage(message.sender),
              firstSeen: Date.now(),
              publicKey: senderKey
            };

            // Update last seen time
            userData.lastSeen = Date.now();

            // Update users
            dispatch({
              type: ACTIONS.UPDATE_USER,
              payload: {
                publicKey: senderKey,
                userData
              }
            });

            // Create message object
            const newMessage = {
              id: `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
              content: sanitizedContent,
              sender: userData.username,
              publicKey: senderKey,
              timestamp: message.timestamp || Date.now(),
              received: true
            };

            // Add to state
            dispatch({
              type: ACTIONS.ADD_MESSAGE,
              payload: {
                roomId,
                message: newMessage
              }
            });
          }
          break;

        case 'profile':
          // Update user profile information
          if (message.publicKey && message.username) {
            const senderKey = sanitizeMessage(message.publicKey);
            const userData = state.users[senderKey] || {
              firstSeen: Date.now(),
              publicKey: senderKey
            };

            // Update profile data
            userData.username = sanitizeMessage(message.username);
            userData.lastSeen = Date.now();
            if (message.avatar) userData.avatar = sanitizeMessage(message.avatar);

            // Update users
            dispatch({
              type: ACTIONS.UPDATE_USER,
              payload: {
                publicKey: senderKey,
                userData
              }
            });
          }
          break;
      }
    } catch (err) {
      // Silently ignore malformed messages
    }
  };

  // Initialize a swarm for a room (only once per room)
  const initRoomSwarm = (room) => {
    // Skip if this room already has a swarm or if identity not loaded
    if (swarmRefs.current.has(room.id) || !state.identity) {
      return;
    }

    try {
      // Create a real Hyperswarm instance
      const swarm = new Hyperswarm();

      // Initialize peer count tracking
      peersRef.current[room.id] = 0;

      dispatch({
        type: ACTIONS.UPDATE_ROOM_STATUS,
        payload: { roomId: room.id, status: 'connecting' }
      });

      // Join the topic based on room ID for consistency
      const topic = createRoomTopic(room.id);
      const discovery = swarm.join(topic, { server: true, client: true });

      // Handle new connections
      swarm.on('connection', (socket, info) => {
        // Update peer count
        peersRef.current[room.id] = (peersRef.current[room.id] || 0) + 1;
        dispatch({
          type: ACTIONS.SET_PEERS,
          payload: {
            roomId: room.id,
            count: peersRef.current[room.id]
          }
        });

        // Send our profile to the new peer
        const profileMsg = JSON.stringify({
          type: 'profile',
          publicKey: state.identity.publicKey,
          username: state.identity.username,
          timestamp: Date.now()
        });
        socket.write(profileMsg);

        // Handle data from this peer
        socket.on('data', data => {
          processIncomingMessage(room.id, data);
        });
        socket.on('error', err => {

        });
        swarm.on('error', (err) => {
          // Log error for debugging but suppress it from console
          console.debug(`Swarm error in room ${room.id}: ${err.message}`);

          // Update room status if it's a serious connection error
          if (err.message.includes('connection timed out') ||
            err.message.includes('connection failed') ||
            err.message.includes('network error')) {
            dispatch({
              type: ACTIONS.UPDATE_ROOM_STATUS,
              payload: { roomId: room.id, status: 'reconnecting' }
            });
          }
        });
        // Handle socket close
        socket.on('close', () => {
          // Update peer count
          peersRef.current[room.id] = Math.max(0, (peersRef.current[room.id] || 0) - 1);
          dispatch({
            type: ACTIONS.SET_PEERS,
            payload: {
              roomId: room.id,
              count: peersRef.current[room.id]
            }
          });
        });
      });

      // Wait for the topic to be announced
      discovery.flushed().then(() => {
        dispatch({
          type: ACTIONS.UPDATE_ROOM_STATUS,
          payload: { roomId: room.id, status: 'connected' }
        });
      });

      // Wait for connections to peers
      swarm.flush().catch(() => {
        // Silently handle flush errors
      });

      // Store the swarm reference
      swarmRefs.current.set(room.id, swarm);

    } catch (err) {
      dispatch({
        type: ACTIONS.UPDATE_ROOM_STATUS,
        payload: { roomId: room.id, status: 'error' }
      });
    }
  };

  // Function to create a new room
  const createRoom = (name) => {
    if (!name || name.trim() === '') {
      return null;
    }

    const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newRoom = {
      id: roomId,
      name: name.trim(),
      created: Date.now(),
      messages: [],
      status: 'new'
    };

    dispatch({ type: ACTIONS.ADD_ROOM, payload: newRoom });

    // Initialize the swarm for this room
    initRoomSwarm(newRoom);

    return roomId;
  };

  // Function to join a room by name or invite code
  const joinRoom = (nameOrInviteCode) => {
    // Check if it's an invite code (base64 encoded JSON)
    if (nameOrInviteCode.startsWith('invite:')) {
      try {
        const base64Data = nameOrInviteCode.substring(7); // Remove 'invite:' prefix

        // In browser environments, use atob instead of Buffer
        let jsonData;
        try {
          // Try using Buffer (Node.js environment)
          jsonData = Buffer.from(base64Data, 'base64').toString('utf8');
        } catch (e) {
          // Fallback to atob (browser environment)
          jsonData = atob(base64Data);
        }

        const roomData = JSON.parse(jsonData);

        // Check if we already have this room
        const existingRoom = state.rooms.find(r => r.id === roomData.id);
        if (existingRoom) {
          dispatch({ type: ACTIONS.SET_ACTIVE_ROOM, payload: existingRoom.id });
          return existingRoom.id;
        }

        // Add the room from the invite
        const newRoom = {
          ...roomData,
          messages: [], // Reset messages for this instance
          status: 'new'  // Will be connected when swarm initializes
        };

        dispatch({ type: ACTIONS.ADD_ROOM, payload: newRoom });
        initRoomSwarm(newRoom);
        return newRoom.id;
      } catch (err) {
        return null;
      }
    }

    // Regular room join by name
    const existingRoom = state.rooms.find(r => r.name.toLowerCase() === nameOrInviteCode.toLowerCase());
    if (existingRoom) {
      dispatch({ type: ACTIONS.SET_ACTIVE_ROOM, payload: existingRoom.id });
      return existingRoom.id;
    }

    // Otherwise create a new room with this name
    return createRoom(nameOrInviteCode);
  };

  // Function to leave/delete a room
  const leaveRoom = async (roomId) => {
    const swarm = swarmRefs.current.get(roomId);
    if (swarm) {
      try {
        await swarm.destroy();
        swarmRefs.current.delete(roomId);
      } catch (err) {
        // Silently handle destroy errors
      }
    }

    dispatch({ type: ACTIONS.REMOVE_ROOM, payload: roomId });

    // Delete the room's message file
    try {
      const roomFile = path.join(CONFIG_DIR, `${roomId}.json`);
      if (fs.existsSync(roomFile)) {
        fs.unlinkSync(roomFile);
      }
    } catch (err) {
      // Silently handle file deletion errors
    }
  };

  // Function to send a message
  const sendMessage = (roomId, content) => {
    if (!content || content.trim() === '' || !state.identity) return;

    // Sanitize content
    const sanitizedContent = sanitizeMessage(content);

    // Create message object
    const message = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
      content: sanitizedContent,
      sender: state.identity.username,
      publicKey: state.identity.publicKey,
      timestamp: Date.now(),
      sent: true
    };

    // Add to local state
    dispatch({
      type: ACTIONS.ADD_MESSAGE,
      payload: { roomId, message }
    });

    // Broadcast to peers
    const swarm = swarmRefs.current.get(roomId);
    if (swarm) {
      const chatMessage = JSON.stringify({
        type: 'chat',
        content: sanitizedContent,
        sender: state.identity.username,
        publicKey: state.identity.publicKey,
        timestamp: message.timestamp
      });

      // Broadcast to all peers
      for (const connection of swarm.connections) {
        try {
          connection.write(chatMessage);
        } catch (err) {
          // Silently handle write errors
        }
      }
    }
  };

  // Function to update user profile
  const updateProfile = (username) => {
    if (!username || !state.identity) return;

    // Sanitize username
    const sanitizedUsername = sanitizeMessage(username);

    // Update identity
    const updatedIdentity = {
      ...state.identity,
      username: sanitizedUsername
    };

    // Save to file
    try {
      fs.writeFileSync(IDENTITY_FILE, JSON.stringify(updatedIdentity, null, 2));
    } catch (err) {
      dispatch({ type: ACTIONS.SET_ERROR, payload: `Failed to save identity: ${err.message}` });
      return false;
    }

    // Update state
    dispatch({ type: ACTIONS.SET_IDENTITY, payload: updatedIdentity });

    // Broadcast profile update to all rooms
    state.rooms.forEach(room => {
      const swarm = swarmRefs.current.get(room.id);
      if (swarm) {
        const profileMessage = JSON.stringify({
          type: 'profile',
          username: sanitizedUsername,
          publicKey: state.identity.publicKey,
          timestamp: Date.now()
        });

        // Broadcast to all peers
        for (const connection of swarm.connections) {
          try {
            connection.write(profileMessage);
          } catch (err) {
            // Silently handle write errors
          }
        }
      }
    });

    return true;
  };

  // Function to create and copy an invite code
  const createInviteCode = (roomId) => {
    const room = state.rooms.find(r => r.id === roomId);
    if (!room) return null;

    // Create a minimal room object for the invite
    const inviteData = {
      id: room.id,
      name: room.name,
      created: room.created
    };

    // Convert to base64
    const jsonData = JSON.stringify(inviteData);

    // Use different methods for Node.js vs browser
    let base64Data;
    try {
      // Node.js environment
      base64Data = Buffer.from(jsonData).toString('base64');
    } catch (e) {
      // Browser environment
      base64Data = btoa(jsonData);
    }

    const inviteCode = `invite:${base64Data}`;

    // Copy to clipboard
    try {
      clipboardy.writeSync(inviteCode);
      return inviteCode;
    } catch (err) {
      return inviteCode; // Return the code even if copying failed
    }
  };

  // Function to set active room
  const setActiveRoom = (roomId) => {
    dispatch({ type: ACTIONS.SET_ACTIVE_ROOM, payload: roomId });
  };

  // Find active room
  const activeRoom = state.rooms.find(room => room.id === state.activeRoomId) || null;

  // Get username for a public key
  const getUserForKey = (publicKey) => {
    if (!publicKey) return 'Unknown';
    if (publicKey === state.identity?.publicKey) return state.identity.username;
    return state.users[publicKey]?.username || `User_${publicKey.substring(0, 6)}`;
  };

  // Provide the context value
  const contextValue = {
    rooms: state.rooms,
    activeRoom,
    activeRoomId: state.activeRoomId,
    error: state.error,
    connecting: state.connecting,
    peers: state.peers,
    users: state.users,
    identity: state.identity,

    createRoom,
    joinRoom,
    leaveRoom,
    sendMessage,
    setActiveRoom,
    createInviteCode,
    updateProfile,
    getUserForKey
  };

  return (
    <P2PRoomContext.Provider value={contextValue}>
      {children}
    </P2PRoomContext.Provider>
  );
}

// Hook to use the P2P room context
export function useP2PRoom() {
  const context = useContext(P2PRoomContext);
  if (!context) {
    throw new Error('useP2PRoom must be used within a P2PRoomProvider');
  }
  return context;
}

export default P2PRoomContext;
