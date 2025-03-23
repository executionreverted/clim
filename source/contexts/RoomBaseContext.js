// contexts/RoomBaseContext.js - Direct integration with RoomBase
import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createHash, randomBytes } from 'crypto';
import Corestore from 'corestore';
import RoomBase from '../utils/roombase.js';

// Configuration for file paths
const CONFIG_DIR = path.join(os.homedir(), '.config/.hyperchatters');
const ROOMS_DIR = path.join(CONFIG_DIR, 'rooms');
const ROOMS_FILE = path.join(CONFIG_DIR, 'room-keys.json');
const IDENTITY_FILE = path.join(CONFIG_DIR, 'identity.json');

// Create the context
const RoomBaseContext = createContext();

// Define action types
const ACTIONS = {
  SET_ROOMS: 'SET_ROOMS',
  SET_ACTIVE_ROOM: 'SET_ACTIVE_ROOM',
  ADD_ROOM: 'ADD_ROOM',
  REMOVE_ROOM: 'REMOVE_ROOM',
  ADD_MESSAGE: 'ADD_MESSAGE',
  SET_ERROR: 'SET_ERROR',
  SET_IDENTITY: 'SET_IDENTITY',
  SET_PEERS: 'SET_PEERS',
  SET_CONNECTIONS: 'SET_CONNECTIONS',
  UPDATE_ROOM_MESSAGES: 'UPDATE_ROOM_MESSAGES'
};

// Initial state
const initialState = {
  rooms: [],
  activeRoomId: null,
  identity: null,
  error: null,
  peers: {}, // roomId -> count
  connections: {} // roomId -> array of connections
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
          : state.activeRoomId,
        peers: { ...state.peers, [action.payload]: undefined },
        connections: { ...state.connections, [action.payload]: undefined }
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

    case ACTIONS.SET_ERROR:
      return { ...state, error: action.payload };

    case ACTIONS.SET_IDENTITY:
      return { ...state, identity: action.payload };

    case ACTIONS.SET_PEERS:
      return {
        ...state,
        peers: {
          ...state.peers,
          [action.payload.roomId]: action.payload.count
        }
      };

    case ACTIONS.SET_CONNECTIONS:
      return {
        ...state,
        connections: {
          ...state.connections,
          [action.payload.roomId]: action.payload.connections
        }
      };
    case ACTIONS.UPDATE_ROOM_MESSAGES:
      return {
        ...state,
        rooms: state.rooms.map(room =>
          room.id === action.payload.roomId
            ? { ...room, messages: action.payload.messages }
            : room
        )
      };
    default:
      return state;
  }
}

// Create or load user identity
function loadOrCreateIdentity() {
  try {
    if (fs.existsSync(IDENTITY_FILE)) {
      return JSON.parse(fs.readFileSync(IDENTITY_FILE, 'utf-8'));
    }

    // Generate new identity
    const publicKey = randomBytes(32).toString('hex');
    const privateKey = randomBytes(32).toString('hex');

    const identity = {
      publicKey,
      privateKey,
      username: `User_${publicKey.substring(0, 6)}`,
      createdAt: Date.now()
    };

    // Ensure directory exists
    if (!fs.existsSync(path.dirname(IDENTITY_FILE))) {
      fs.mkdirSync(path.dirname(IDENTITY_FILE), { recursive: true });
    }

    // Save identity
    fs.writeFileSync(IDENTITY_FILE, JSON.stringify(identity, null, 2));

    return identity;
  } catch (err) {
    console.error(`Failed to create/load identity:`, err);
    // Return a fallback identity if file operations fail
    const publicKey = randomBytes(32).toString('hex');
    return {
      publicKey,
      username: `User_${publicKey.substring(0, 6)}`,
      createdAt: Date.now()
    };
  }
}

// Make sure directory exists
function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Provider component
export function RoomBaseProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const roomInstances = useRef(new Map()); // Map roomId -> RoomBase instance
  const corestores = useRef(new Map()); // Map roomId -> Corestore instance
  const messageListeners = useRef(new Map()); // Map roomId -> function[] (for message event listeners)

  // Ensure config directory exists and load identity
  useEffect(() => {
    try {
      // Ensure all required directories exist
      ensureDirectoryExists(CONFIG_DIR);
      ensureDirectoryExists(ROOMS_DIR);

      // Load identity
      const identity = loadOrCreateIdentity();
      dispatch({ type: ACTIONS.SET_IDENTITY, payload: identity });

      // Load room keys
      if (fs.existsSync(ROOMS_FILE)) {
        const roomKeys = JSON.parse(fs.readFileSync(ROOMS_FILE, 'utf-8'));
        initializeRooms(roomKeys);
      } else {
        fs.writeFileSync(ROOMS_FILE, JSON.stringify([]));
      }
    } catch (err) {
      dispatch({ type: ACTIONS.SET_ERROR, payload: `Initialization error: ${err.message}` });
    }

    // Cleanup when unmounting
    return () => {
      // Close each room instance and its corestore
      for (const [roomId, room] of roomInstances.current.entries()) {
        room.close().catch(err => {
          console.error(`Error closing room ${roomId}:`, err);
        });
      }
      roomInstances.current.clear();

      // Close all corestores
      for (const [roomId, store] of corestores.current.entries()) {
        store.close().catch(err => {
          console.error(`Error closing corestore for room ${roomId}:`, err);
        });
      }
      corestores.current.clear();
    };
  }, []);


  const setupMessageListener = (room, roomId) => {
    if (!room) return;

    room.on('update', async () => {
      try {
        updatePeerInfo(roomId);
      } catch (err) {
        console.error(`Error handling room update: ${err.message}`);
      }
    });
    // Listen for new messages
    room.on('new-message', (message) => {
      dispatch({
        type: ACTIONS.ADD_MESSAGE,
        payload: { roomId, message }
      });
    });

    room.on('mistake', (message) => {
      dispatch({
        type: ACTIONS.SET_ERROR,
        payload: JSON.stringify(message)
      });
    });
  };





  const initializeRooms = async (roomKeys) => {
    const roomsWithMessages = [];

    for (const roomKey of roomKeys) {
      try {
        // Create a unique corestore for each room
        const roomStorePath = path.join(ROOMS_DIR, roomKey.id);
        ensureDirectoryExists(roomStorePath);

        const store = new Corestore(roomStorePath);
        await store.ready();
        corestores.current.set(roomKey.id, store);

        // Create RoomBase instance with the room-specific corestore
        const room = new RoomBase(store, {
          key: roomKey.key,
          encryptionKey: roomKey.encryptionKey,
          roomId: roomKey.id,
          roomName: roomKey.name
        });

        await room.ready();
        roomInstances.current.set(roomKey.id, room);

        // Set up message listener
        setupMessageListener(room, roomKey.id);

        // Get messages using IndexStream properly
        let messages = [];
        try {
          // Get message stream with limit
          const stream = room.getMessages({ limit: 1, reverse: true });

          // Process the stream
          await new Promise(resolve => {
            // If it's a promise (already an array)
            if (stream.then) {
              stream.then(result => {
                messages = result;
                resolve();
              }).catch(err => {
                console.error(`Error processing message stream for room ${roomKey.id}:`, err);
                resolve();
              });
              return;
            }

            // Handle as Node.js stream
            if (stream.on) {
              stream.on('data', message => {
                messages.push(message);
              });

              stream.on('error', err => {
                console.error(`Error reading message stream for room ${roomKey.id}:`, err);
                resolve();
              });

              stream.on('end', () => {
                resolve();
              });
            } else {
              // Fallback - assume it's already an array
              messages = Array.isArray(stream) ? stream : [];
              resolve();
            }
          });
        } catch (msgErr) {
          console.error(`Error retrieving messages for room ${roomKey.id}:`, msgErr);
        }

        // Add room to state
        roomsWithMessages.push({
          id: roomKey.id,
          name: roomKey.name,
          key: roomKey.key,
          encryptionKey: roomKey.encryptionKey,
          messages: messages || [],
          status: 'connected'
        });

        // Initialize peer count
        updatePeerInfo(roomKey.id);

      } catch (err) {
        console.error(`Error initializing room ${roomKey.id}:`, err);
        roomsWithMessages.push({
          id: roomKey.id,
          name: roomKey.name,
          messages: [],
          status: 'error',
          error: err.message
        });
      }
    }

    if (roomsWithMessages.length > 0) {
      dispatch({ type: ACTIONS.SET_ROOMS, payload: roomsWithMessages });
      dispatch({ type: ACTIONS.SET_ACTIVE_ROOM, payload: roomsWithMessages[0].id });
    }
  };



  // Update peer information for a room
  const updatePeerInfo = async (roomId) => {
    const room = roomInstances.current.get(roomId);
    if (!room) return;

    try {
      const writers = await room.getWriters({ includeMetadata: true });
      const peerCount = writers.length;

      // Update peer count
      dispatch({
        type: ACTIONS.SET_PEERS,
        payload: { roomId, count: peerCount }
      });

      // Update connections
      const connections = writers.map(writer => ({
        id: writer.key,
        publicKey: writer.key,
        username: writer.key === state.identity?.publicKey ?
          state.identity.username :
          `User_${writer.key.substring(0, 6)}`,
        lastSeen: writer.lastActivity || Date.now(),
        isYou: writer.key === state.identity?.publicKey,
        anonymous: false
      }));

      dispatch({
        type: ACTIONS.SET_CONNECTIONS,
        payload: { roomId, connections }
      });
    } catch (err) {
      console.error(`Error updating peer info for room ${roomId}:`, err);
    }
  };

  // Save room keys to file
  const saveRoomsToFile = () => {
    try {
      const roomKeys = state.rooms.map(room => ({
        id: room.id,
        name: room.name,
        key: room.key,
        encryptionKey: room.encryptionKey
      }));
      fs.writeFileSync(ROOMS_FILE, JSON.stringify(roomKeys, null, 2));
    } catch (err) {
      console.error('Error saving room keys:', err);
      dispatch({ type: ACTIONS.SET_ERROR, payload: `Failed to save room keys: ${err.message}` });
    }
  };

  // Save rooms to file when they change
  useEffect(() => {
    if (state.rooms.length > 0) {
      saveRoomsToFile();
    }
  }, [state.rooms.length, state.rooms.map(r => r.id).join(',')]);

  // Function to create a new room
  const createRoom = async (name) => {
    if (!name || name.trim() === '') {
      return null;
    }

    try {
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const roomName = name.trim();

      // Create a unique directory for this room's corestore
      const roomStorePath = path.join(ROOMS_DIR, roomId);
      ensureDirectoryExists(roomStorePath);

      // Create a dedicated corestore for this room
      const store = new Corestore(roomStorePath);
      await store.ready();
      corestores.current.set(roomId, store);

      // Create RoomBase instance with the room-specific corestore
      const room = new RoomBase(store, {
        roomId,
        roomName
      });

      await room.ready();

      // Get room key information
      const roomKey = {
        id: roomId,
        name: roomName,
        key: room.key.toString('hex'),
        encryptionKey: room.encryptionKey.toString('hex')
      };

      // Store the room instance
      roomInstances.current.set(roomId, room);
      setupMessageListener(room, roomId);

      // Add to state
      const newRoom = {
        id: roomId,
        name: roomName,
        key: roomKey.key,
        encryptionKey: roomKey.encryptionKey,
        messages: [],
        status: 'connected'
      };

      dispatch({ type: ACTIONS.ADD_ROOM, payload: newRoom });
      return roomId;
    } catch (err) {
      dispatch({ type: ACTIONS.SET_ERROR, payload: `Failed to create room: ${err.message}` });
      return null;
    }
  };

  // Function to join a room by invite code
  // Function to join a room by invite code with better resource management
  const joinRoom = async (inviteCode) => {
    if (!inviteCode) return null;

    let store = null;
    let roomId = null;

    try {
      // Check if it's already an existing room
      const existingRoom = state.rooms.find(r => r.name === inviteCode);
      if (existingRoom) {
        dispatch({ type: ACTIONS.SET_ACTIVE_ROOM, payload: existingRoom.id });
        return existingRoom.id;
      }

      // Determine if it's an invite code
      if (inviteCode) {
        // Generate a unique room ID
        roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        // Create a unique directory for this room's corestore
        const roomStorePath = path.join(ROOMS_DIR, roomId);
        ensureDirectoryExists(roomStorePath);

        // Create a dedicated corestore for this room
        store = new Corestore(roomStorePath);
        await store.ready();


        // It's an invite code, pair with the room
        const pair = RoomBase.pair(store, inviteCode);

        // Wait for pairing to complete
        const room = await pair.finished();

        // Only now store the corestore after successful pairing
        corestores.current.set(roomId, store);

        // Get room info
        const roomInfo = await room.getRoomInfo();

        const roomName = roomInfo?.name || 'Joined Room';

        // Store the room instance
        roomInstances.current.set(roomId, room);

        // Setup listeners after the room is fully initialized
        setupMessageListener(room, roomId);

        // Get existing messages safely
        let messages = [];
        try {
          const messagesResult = await room.getMessages({ limit: 100 });
          messages = messagesResult?.messages || [];
        } catch (msgErr) {
          console.error('Failed to retrieve messages:', msgErr);
          // Continue with empty messages array
        }

        // Add to state
        const newRoom = {
          id: roomId,
          name: roomName,
          key: room.key?.toString('hex'),
          encryptionKey: room.encryptionKey?.toString('hex'),
          messages: messages,
          status: 'connected'
        };

        // Update state in a single batch to prevent race conditions
        dispatch({ type: ACTIONS.ADD_ROOM, payload: newRoom });
        dispatch({ type: ACTIONS.SET_ACTIVE_ROOM, payload: roomId });


        // Force an update of peer info after a delay
        setTimeout(() => {
          try {
            updatePeerInfo(roomId);
          } catch (peerErr) {
            console.error('Error updating peer info:', peerErr);
          }
        }, 1000);

        return roomId;
      } else {
        // It's a room name, create a new room
        return createRoom(inviteCode);
      }
    } catch (err) {
      console.error(`Error in joinRoom:`, err);

      // Clean up resources on error
      if (store && roomId && !corestores.current.has(roomId)) {
        try {
          await store.close();
        } catch (closeErr) {
          console.error('Error closing corestore:', closeErr);
        }
      }

      dispatch({ type: ACTIONS.SET_ERROR, payload: `Failed to join room: ${err.message}` });
      return null;
    }
  }
  // Function to leave a room
  const leaveRoom = async (roomId) => {
    try {
      const room = roomInstances.current.get(roomId);
      if (room) {
        // Remove message listeners
        const listeners = messageListeners.current.get(roomId) || [];
        for (const listener of listeners) {
          room.off('new-messages', listener);
        }
        messageListeners.current.delete(roomId);

        // Close the room
        await room.close();
        roomInstances.current.delete(roomId);
      }

      // Close and cleanup the corestore
      const store = corestores.current.get(roomId);
      if (store) {
        await store.close();
        corestores.current.delete(roomId);
      }

      // Optionally remove the room directory
      const roomStorePath = path.join(ROOMS_DIR, roomId);
      try {
        // Commented out to preserve data - uncomment if you want to delete room data
        fs.rm(roomStorePath, { recursive: true, force: true }, () => { });
      } catch (err) {
        console.error(`Error removing room directory: ${err.message}`);
      }

      dispatch({ type: ACTIONS.REMOVE_ROOM, payload: roomId });
      return true;
    } catch (err) {
      dispatch({ type: ACTIONS.SET_ERROR, payload: `Failed to leave room: ${err.message}` });
      return false;
    }
  };


  // Simpler version of the loadMoreMessages function
  // Add this debugging version of loadMoreMessages to RoomBaseContext.js

  // In RoomBaseContext.js

  const loadMoreMessages = async (roomId) => {
    if (!roomId) return false;

    const room = roomInstances.current.get(roomId);
    if (!room) return false;

    try {
      // Get current room from state
      const currentRoom = state.rooms.find(r => r.id === roomId);
      if (!currentRoom) return false;

      // Get current messages
      const currentMessages = currentRoom.messages || [];

      // Find oldest message to use as starting point
      const oldestTimestamp = currentMessages.length > 0
        ? Math.min(...currentMessages.map(msg => msg.timestamp || Infinity))
        : Infinity;

      // Get older messages
      const olderMessagesStream = room.getMessages({
        limit: 1,
        lt: oldestTimestamp !== Infinity ? { timestamp: oldestTimestamp } : undefined,
        reverse: true
      });

      // Process stream
      let olderMessages = [];

      if (olderMessagesStream.then) {
        olderMessages = await olderMessagesStream;
      } else if (olderMessagesStream.on) {
        olderMessages = await new Promise(resolve => {
          const results = [];
          olderMessagesStream.on('data', msg => results.push(msg));
          olderMessagesStream.on('end', () => resolve(results));
          olderMessagesStream.on('error', () => resolve([]));
        });
      } else if (Array.isArray(olderMessagesStream)) {
        olderMessages = olderMessagesStream;
      }

      // If no older messages found
      if (olderMessages.length === 0) return false;

      // Update room with combined messages
      dispatch({
        type: ACTIONS.UPDATE_ROOM_MESSAGES,
        payload: {
          roomId,
          messages: [...olderMessages, ...currentMessages]
        }
      });

      return true;
    } catch (err) {
      console.error(`Error loading more messages:`, err);
      return false;
    }
  };


  // Function to send a message
  const sendMessage = async (roomId, content, isSystemMessage = false) => {
    if (!content || content.trim() === '' || !state.identity) return false;

    const room = roomInstances.current.get(roomId);
    if (!room) return false;

    try {
      // Create message object
      const message = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
        content: content.trim(),
        sender: state.identity.username,
        timestamp: Date.now(),
        system: isSystemMessage
      };

      // Send through RoomBase
      await room.sendMessage(message);
      // Add to state (this will likely be duplicated by the message listener,
      // but ensuring immediate feedback is worth it)

      return true;
    } catch (err) {
      console.error(`Error sending message to room ${roomId}:`, err);
      return false;
    }
  };

  // Function to create an invite code
  const createInviteCode = async (roomId) => {
    const room = roomInstances.current.get(roomId);
    if (!room) return null;

    try {
      const inviteCode = await room.createInvite();

      return inviteCode;
    } catch (err) {
      console.error(`Error creating invite for room ${roomId}:`, err);
      return null;
    }
  };

  // Function to update user profile
  const updateProfile = async (username) => {
    if (!username || !state.identity) return false;

    try {
      // Update identity
      const updatedIdentity = {
        ...state.identity,
        username
      };

      // Save to file
      fs.writeFileSync(IDENTITY_FILE, JSON.stringify(updatedIdentity, null, 2));

      // Update state
      dispatch({ type: ACTIONS.SET_IDENTITY, payload: updatedIdentity });

      // Send update notification to all rooms
      for (const [roomId, room] of roomInstances.current.entries()) {
        try {
          sendMessage(roomId, `${state.identity.username} changed their name to "${username}"`, true);
        } catch (err) {
          console.error(`Error sending name change notification to room ${roomId}:`, err);
        }
      }

      return true;
    } catch (err) {
      console.error('Error updating profile:', err);
      return false;
    }
  };

  // Function to set active room
  const setActiveRoom = (roomId) => {
    dispatch({ type: ACTIONS.SET_ACTIVE_ROOM, payload: roomId });
  };

  // Find active room
  const activeRoom = state.rooms.find(room => room.id === state.activeRoomId) || null;

  // Get connections for a room
  const getConnections = (roomId) => {
    return state.connections[roomId] || [];
  };

  // Provide the context value
  const contextValue = {
    rooms: state.rooms,
    activeRoom,
    activeRoomId: state.activeRoomId,
    error: state.error,
    identity: state.identity,
    peers: state.peers,
    connections: state.connections,

    createRoom,
    joinRoom,
    leaveRoom,
    sendMessage,
    setActiveRoom,
    createInviteCode,
    updateProfile,
    getConnections,
    loadMoreMessages,
  };

  return (
    <RoomBaseContext.Provider value={contextValue}>
      {children}
    </RoomBaseContext.Provider>
  );
}

// Hook to use the RoomBase context
export function useRoomBase() {
  const context = useContext(RoomBaseContext);
  if (!context) {
    throw new Error('useRoomBase must be used within a RoomBaseProvider');
  }
  return context;
}

export default RoomBaseContext;
