// contexts/RoomBaseContext.js - Updated for Hyperblobs
import React, { useCallback, createContext, useContext, useReducer, useEffect, useRef } from 'react';
import fs, { writeFileSync } from 'fs';
import path from 'path';
import os from 'os';
import { randomBytes } from 'crypto';
import Corestore from 'corestore';
import RoomBase from '../utils/roombase.js';
import Hyperblobs from 'hyperblobs';
import Hypercore from 'hypercore';

// Configuration for file paths
const CONFIG_DIR = path.join(os.homedir(), '.config/.hyperchatters2');
const ROOMS_DIR = path.join(CONFIG_DIR, 'rooms');
const BLOBS_DIR = path.join(CONFIG_DIR, 'blobs');
const REMOTE_BLOBS_PATH = path.join(CONFIG_DIR, 'remote-blobs');
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
  UPDATE_ROOM_MESSAGES: 'UPDATE_ROOM_MESSAGES',
  UPDATE_MESSAGE_COUNT: 'UPDATE_MESSAGE_COUNT',
  SET_ROOM_FILES: 'SET_ROOM_FILES',
  ADD_ROOM_FILE: 'ADD_ROOM_FILE',
  REMOVE_ROOM_FILE: 'REMOVE_ROOM_FILE',
  SET_FILE_LOADING: 'SET_FILE_LOADING',
  SET_CURRENT_DIRECTORY: 'SET_CURRENT_DIRECTORY'
};

// Initial state
const initialState = {
  rooms: [],
  activeRoomId: null,
  identity: null,
  error: null,
  peers: {}, // roomId -> count
  connections: {}, // roomId -> array of connections
  messageCounts: {}, // roomId -> total message count
  files: {}, // Map roomId -> array of files
  fileLoading: false,
  currentDirectory: {}
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

    case ACTIONS.UPDATE_MESSAGE_COUNT:
      return {
        ...state,
        messageCounts: {
          ...state.messageCounts,
          [action.payload.roomId]: action.payload.count
        }
      };

    case ACTIONS.SET_ROOM_FILES:
      return {
        ...state,
        files: {
          ...state.files,
          [action.payload.roomId]: action.payload.files
        }
      };

    case ACTIONS.ADD_ROOM_FILE:
      return {
        ...state,
        files: {
          ...state.files,
          [action.payload.roomId]: [
            ...(state.files[action.payload.roomId] || []),
            action.payload.file
          ]
        }
      };

    case ACTIONS.REMOVE_ROOM_FILE:
      return {
        ...state,
        files: {
          ...state.files,
          [action.payload.roomId]: (state.files[action.payload.roomId] || [])
            .filter(file => file.path !== action.payload.path)
        }
      };

    case ACTIONS.SET_FILE_LOADING:
      return {
        ...state,
        fileLoading: action.payload
      };

    case ACTIONS.SET_CURRENT_DIRECTORY:
      return {
        ...state,
        currentDirectory: {
          ...state.currentDirectory,
          [action.payload.roomId]: action.payload.path
        }
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
  const joinInProgress = useRef(false);
  const seenMessageIds = useRef(new Map()); // Map roomId -> Set of seen message IDs

  const loadingRooms = useRef(new Set());
  const blobStore = useRef(null)

  const isMessageDuplicate = (roomId, messageId) => {
    if (!roomId || !messageId) return false;

    // Get or create the set for this room
    if (!seenMessageIds.current.has(roomId)) {
      seenMessageIds.current.set(roomId, new Set());
    }

    const roomMessageIds = seenMessageIds.current.get(roomId);

    // Check if message is a duplicate
    if (roomMessageIds.has(messageId)) {
      return true;
    }

    // Not a duplicate - add to seen messages
    roomMessageIds.add(messageId);

    // Limit set size (keep last 1000 message IDs)
    if (roomMessageIds.size > 1000) {
      const oldestId = roomMessageIds.values().next().value;
      roomMessageIds.delete(oldestId);
    }

    return false;
  };

  const saveRoomsToFile = () => {
    try {
      const roomKeys = state.rooms.map(room => {
        return {
          id: room.id,
          name: room.name,
          key: room.key,
          encryptionKey: room.encryptionKey
        };
      });

      // Ensure directory exists before trying to write
      ensureDirectoryExists(path.dirname(ROOMS_FILE));

      // Write file synchronously to ensure it completes
      fs.writeFileSync(ROOMS_FILE, JSON.stringify(roomKeys, null, 2));
      console.log(`Saved ${roomKeys.length} rooms to ${ROOMS_FILE}`);
    } catch (err) {
      console.error('Error saving room keys:', err);
      dispatch({ type: ACTIONS.SET_ERROR, payload: `Failed to save room keys: ${err.message}` });
    }
  };

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
        try {
          const roomKeysStr = fs.readFileSync(ROOMS_FILE, 'utf-8');
          // Add extra safety with try-catch for JSON parsing
          try {
            const roomKeys = JSON.parse(roomKeysStr);
            console.log(`Found ${roomKeys.length} rooms in storage file`);

            // Initialize rooms with debug logging
            initializeRooms(roomKeys);
          } catch (jsonErr) {
            console.error(`Error parsing room keys JSON: ${jsonErr.message}`);
            console.error(`Content of file: ${roomKeysStr}`);
            fs.writeFileSync(ROOMS_FILE, JSON.stringify([]));
          }
        } catch (readErr) {
          console.error(`Error reading rooms file: ${readErr.message}`);
          process.exit("1");
        }
      } else {
        console.log(`No rooms file found, creating empty one at ${ROOMS_FILE}`);
        // Ensure directory exists before writing file
        ensureDirectoryExists(path.dirname(ROOMS_FILE));
        fs.writeFileSync(ROOMS_FILE, JSON.stringify([]));
      }
    } catch (err) {
      console.error(`Initialization error:`, err);
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
      if (!message || !message.id) return;
      if (isMessageDuplicate(roomId, message.id)) {
        return; // Skip this message since it's a duplicate
      }
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

  // Updated to use Hyperblobs for file uploads
  const uploadFile = useCallback(async (roomId, file, customPath = null) => {
    const room = roomInstances.current.get(roomId);
    if (!room) return false;

    dispatch({ type: ACTIONS.SET_FILE_LOADING, payload: true });

    try {
      // Determine file path/name
      let fileName;
      if (customPath) {
        fileName = path.basename(customPath);
      } else if (file.name) {
        fileName = file.name;
      } else if (file.path) {
        fileName = path.basename(file.path);
      } else {
        fileName = `file-${Date.now()}.bin`;
      }

      // Read file data
      let fileData;
      if (file instanceof Buffer) {
        fileData = file;
      } else if (file.arrayBuffer) {
        // Browser File object
        fileData = Buffer.from(await file.arrayBuffer());
      } else if (file.path) {
        // Node.js file path
        fileData = await fs.promises.readFile(file.path);
      } else {
        return false;
      }

      // Upload to blob store and get attachment reference
      const attachment = await room.uploadFile(fileData, fileName);

      if (attachment) {
        // Send a message about the file sharing with the attachment reference
        await room.sendMessage({
          id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
          content: `📄 Shared file: ${attachment.name} (${attachment.size} bytes)`,
          sender: state.identity ? state.identity.username : 'System',
          timestamp: Date.now(),
          hasAttachments: true,
          attachments: [attachment]
        });

        // Add file to our state directly for immediate UI update
        dispatch({
          type: ACTIONS.ADD_ROOM_FILE,
          payload: {
            roomId,
            file: {
              ...attachment,
              sender: state.identity ? state.identity.username : 'System',
              isDirectory: false
            }
          }
        });

        // Load all files to update the state
        loadRoomFiles(roomId);
        return true;
      }

      return false;
    } catch (err) {
      console.error(`Error uploading file to room ${roomId}:`, err);
      return false;
    } finally {
      dispatch({ type: ACTIONS.SET_FILE_LOADING, payload: false });
    }
  }, [state.identity]);

  // Updated to use Hyperblobs for file downloads
  const downloadFile = useCallback(async (roomId, filePathOrRef, saveAs = null) => {
    const room = roomInstances.current.get(roomId);
    if (!room) return null;

    try {
      // Download the file using roombase's downloadFile
      const data = await room.downloadFile(filePathOrRef, REMOTE_BLOBS_PATH);

      // If in Node.js environment and saveAs is provided, save to disk
      if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        if (saveAs && data) {
          await fs.promises.writeFile(saveAs, data);
        }
      }

      return data;
    } catch (err) {
      console.error(`Error downloading file from room ${roomId}:`, err);
      return null;
    }
  }, []);

  // Updated to use blob references in messages instead of a drive
  const loadRoomFiles = useCallback(async (roomId, directory = '/') => {
    if (!roomId) {
      console.error("No roomId provided to loadRoomFiles");
      return [];
    }

    // Prevent multiple concurrent loads
    if (loadingRooms.current.has(roomId)) {
      console.log(`Skip loading files for ${roomId} - already in progress`);
      return [];
    }

    loadingRooms.current.add(roomId);

    try {
      const room = roomInstances.current.get(roomId);

      if (!room) {
        console.error(`No room instance found for ID ${roomId}`);
        return [];
      }

      dispatch({ type: ACTIONS.SET_FILE_LOADING, payload: true });

      try {
        // Use the flat structure from getFiles
        const files = await room.getFiles('/', { recursive: false });

        dispatch({
          type: ACTIONS.SET_ROOM_FILES,
          payload: { roomId, files }
        });

        dispatch({
          type: ACTIONS.SET_CURRENT_DIRECTORY,
          payload: { roomId, path: '/' }
        });

        return files;
      } catch (err) {
        console.error(`Error loading files for room ${roomId}:`, err);
        writeFileSync('./loadroomfiles', JSON.stringify(err.message))
        return [];
      } finally {
        dispatch({ type: ACTIONS.SET_FILE_LOADING, payload: false });
      }
    } finally {
      loadingRooms.current.delete(roomId);
    }
  }, []);

  // Deleted file with blob references
  const deleteFile = useCallback(async (roomId, path) => {
    const room = roomInstances.current.get(roomId);
    if (!room) return false;

    try {
      const success = await room.deleteFile(path);

      if (success) {
        // Update state directly for immediate feedback
        dispatch({
          type: ACTIONS.REMOVE_ROOM_FILE,
          payload: { roomId, path }
        });

        // Then reload files to ensure consistency
        await loadRoomFiles(roomId);
      }

      return success;
    } catch (err) {
      console.error(`Error deleting file from room ${roomId}:`, err);
      return false;
    }
  }, [loadRoomFiles]);

  // This is just a stub since Hyperblobs doesn't use directories
  const createDirectory = useCallback(async (roomId, path) => {
    console.warn("createDirectory is not supported with Hyperblobs - using flat file structure");
    return false;
  }, []);

  // Just load all files since we use a flat structure now
  const navigateDirectory = useCallback((roomId, path) => {
    dispatch({
      type: ACTIONS.SET_CURRENT_DIRECTORY,
      payload: { roomId, path }
    });

    // Just reload all files
    return loadRoomFiles(roomId);
  }, []);

  const createBlobCore = async () => {
    const blobsCore = new Hypercore(BLOBS_DIR)
    await blobsCore.ready()

    corestores.current.set('blobcore', blobsCore)
    return { blobsCore }
  }

  const getBlobStore = async () => {
    try {
      let blobCore = corestores.current.get('blobcore')

      if (!blobCore) {
        const result = await createBlobCore()
        blobCore = result.blobsCore
      }

      // Ensure blob store is always created with a ready core
      if (!blobStore.current) {
        blobStore.current = new Hyperblobs(blobCore)
        await blobStore.current.ready()
      }

      return {
        blobCore: blobCore,
        blobStore: blobStore.current
      }
    } catch (err) {
      console.error('Error initializing blob store:', err)
      throw err
    }
  }

  const initializeRooms = async (roomKeys) => {
    const roomsWithMessages = [];

    for (const roomKey of roomKeys) {
      try {
        if (corestores.current.get(roomKey.id)) {
          continue;
        }
        // Create a unique corestore for each room
        const roomStorePath = path.join(ROOMS_DIR, roomKey.id);
        ensureDirectoryExists(roomStorePath);

        const store = new Corestore(roomStorePath);
        await store.ready();
        corestores.current.set(roomKey.id, store);
        const { blobStore, blobCore } = await getBlobStore()

        // Create RoomBase instance with the room-specific corestore
        const room = new RoomBase(store, {
          key: roomKey.key,
          encryptionKey: roomKey.encryptionKey,
          roomId: roomKey.id,
          roomName: roomKey.name,
          blobStore,
          blobCore
        });

        await room.ready();
        roomInstances.current.set(roomKey.id, room);

        // Set up message listener
        setupMessageListener(room, roomKey.id);
        try {
          await updateMessageCount(roomKey.id);
        } catch (countErr) {
          console.error(`Error getting message count for room ${roomKey.id}:`, countErr);
        }

        // Get messages using IndexStream properly
        let messages = [];
        try {
          // Get message stream with limit
          const stream = room.getMessages({ limit: 10, reverse: true });

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

        // Load initial files
        loadRoomFiles(roomKey.id).catch(err => {
          console.error(`Error loading initial files for room ${roomKey.id}:`, err);
        });

      } catch (err) {
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

  const updateMessageCount = async (roomId) => {
    const room = roomInstances.current.get(roomId);
    if (!room) return;

    try {
      const count = await room.getMessageCount();
      dispatch({
        type: ACTIONS.UPDATE_MESSAGE_COUNT,
        payload: { roomId, count }
      });
    } catch (err) {
      console.error(`Error getting message count for room ${roomId}:`, err);
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

  // Save rooms to file when they change
  useEffect(() => {
    // Only save if we have rooms
    if (state.rooms.length !== 0) {
      saveRoomsToFile();
    }
  }, [state.rooms]);

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


      const { blobStore, blobCore } = await getBlobStore()
      // Create RoomBase instance with the room-specific corestore
      const room = new RoomBase(store, {
        roomId,
        roomName,
        blobCore,
        blobStore
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
      writeFileSync('./creationerr', JSON.stringify(err.message))
      dispatch({ type: ACTIONS.SET_ERROR, payload: `Failed to create room: ${err.message}` });
      return null;
    }
  };

  // Function to join a room by invite code with better resource management
  const joinRoom = async (inviteCode) => {
    if (joinInProgress.current) return;
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
        joinInProgress.current = true;
        // Generate a unique room ID
        roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        // Create a unique directory for this room's corestore
        const roomStorePath = path.join(ROOMS_DIR, roomId);
        ensureDirectoryExists(roomStorePath);

        // Create a dedicated corestore for this room
        store = new Corestore(roomStorePath);
        await store.ready();

        const { blobStore, blobCore } = await getBlobStore()
        // Use the static joinRoom method
        const room = await RoomBase.joinRoom(store, inviteCode, {
          blobStore, blobCore
        });
        await room.ready();

        // Only now store the corestore after successful pairing
        corestores.current.set(roomId, store);

        // Get room info
        const roomInfo = await room.getRoomInfo();
        const roomName = roomInfo?.name || 'Joined Room';

        // Store the room instance
        roomInstances.current.set(roomId, room);
        setupMessageListener(room, roomId);

        // Get messages
        let messages = [];
        try {
          await updateMessageCount(roomId);

          try {
            // Add explicit await and limit
            const messageStream = room.getMessages({ limit: 10, reverse: true });

            // Handle different return types (promise vs stream)
            if (messageStream.then) {
              // It's a promise that resolves to an array
              messages = await messageStream;
            } else if (messageStream.on) {
              // It's a Node.js stream
              messages = await new Promise((resolve, reject) => {
                const results = [];
                messageStream.on('data', msg => results.push(msg));
                messageStream.on('end', () => resolve(results));
                messageStream.on('error', err => {
                  console.error('Error in message stream:', err);
                  resolve(results); // Resolve with partial results on error
                });
              });
            } else if (Array.isArray(messageStream)) {
              // It's already an array
              messages = messageStream;
            }

            console.log(`Loaded ${messages.length} initial messages for room ${roomId}`);
          } catch (msgErr) {
            console.error('Failed to retrieve messages:', msgErr);
            // Still proceed with empty messages array
          }

        } catch (msgErr) {
          console.error('Failed to retrieve messages:', msgErr);
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

        // Update state
        dispatch({ type: ACTIONS.ADD_ROOM, payload: newRoom });
        dispatch({ type: ACTIONS.SET_ACTIVE_ROOM, payload: roomId });

        // Load initial files
        loadRoomFiles(roomId).catch(err => {
          console.error(`Error loading initial files:`, err);
        });

        joinInProgress.current = false;
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
  };

  // Function to leave a room
  const leaveRoom = async (roomId) => {
    try {
      const room = roomInstances.current.get(roomId);
      if (room) {
        // Remove message listeners
        const listeners = messageListeners.current.get(roomId) || [];
        for (const listener of listeners) {
          room.off('new-message', listener);
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
      saveRoomsToFile();
      return true;
    } catch (err) {
      dispatch({ type: ACTIONS.SET_ERROR, payload: `Failed to leave room: ${err.message}` });
      return false;
    }
  };

  // Add this debugging version of loadMoreMessages to RoomBaseContext.js
  const loadMoreMessages = async (roomId, options = {}) => {
    if (!roomId) return false;

    const room = roomInstances.current.get(roomId);
    if (!room) return false;

    const { limit = 20, showLoading = true } = options;

    try {
      // Get current room from state
      const currentRoom = state.rooms.find(r => r.id === roomId);
      if (!currentRoom) return false;

      // Get current messages and count
      const currentMessages = currentRoom.messages || [];
      const totalMessageCount = await room.getMessageCount();

      // Update the message count in state
      dispatch({
        type: ACTIONS.UPDATE_MESSAGE_COUNT,
        payload: { roomId, count: totalMessageCount }
      });

      // If we already have all messages, don't fetch more
      if (currentMessages.length >= totalMessageCount) {
        return false;
      }

      // Find oldest message to use as starting point
      let oldestMessage = null;

      for (const msg of currentMessages) {
        if (!oldestMessage || (msg.timestamp && msg.timestamp < oldestMessage.timestamp)) {
          oldestMessage = msg;
        }
      }

      // Construct query options
      const queryOptions = {
        limit: limit,
        reverse: false // Oldest first for this query (we want older messages)
      };

      // If we have messages already, use oldest as upper bound
      if (oldestMessage && oldestMessage.timestamp) {
        queryOptions.lt = { timestamp: oldestMessage.timestamp };
      }

      // Get older messages
      const olderMessagesStream = room.getMessages(queryOptions);

      // Process stream results
      let olderMessages = [];

      if (olderMessagesStream.then) {
        // It's a promise that resolves to an array
        olderMessages = await olderMessagesStream;
      } else if (olderMessagesStream.on) {
        // It's a Node.js stream
        olderMessages = await new Promise(resolve => {
          const results = [];
          olderMessagesStream.on('data', msg => results.push(msg));
          olderMessagesStream.on('end', () => resolve(results));
          olderMessagesStream.on('error', () => resolve([]));
        });
      } else if (Array.isArray(olderMessagesStream)) {
        // It's already an array
        olderMessages = olderMessagesStream;
      }

      // If no older messages found
      if (!olderMessages || olderMessages.length === 0) {
        // Double-check our count - maybe it's wrong?
        await updateMessageCount(roomId);
        return false;
      }

      // Filter out any messages that might be duplicates (by ID)
      const currentMessageIds = new Set(currentMessages.map(msg => msg.id));
      const uniqueOlderMessages = olderMessages.filter(msg => !currentMessageIds.has(msg.id));

      if (uniqueOlderMessages.length === 0) {
        return false; // No new unique messages found
      }

      // Combine messages, keeping them sorted by timestamp
      const combinedMessages = [...uniqueOlderMessages, ...currentMessages]
        .sort((a, b) => a.timestamp - b.timestamp);

      // Update room with combined messages
      dispatch({
        type: ACTIONS.UPDATE_ROOM_MESSAGES,
        payload: {
          roomId,
          messages: combinedMessages
        }
      });

      // Always return true if we added messages successfully
      // This will ensure the component knows more messages might be available
      return uniqueOlderMessages.length >= limit;
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

      if (isSystemMessage) {
        dispatch({
          type: ACTIONS.ADD_MESSAGE,
          payload: {
            roomId: room.roomId,
            message: message,
          }
        });
        return true;
      }

      // Send through RoomBase
      await room.sendMessage(message);

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
    messageCounts: state.messageCounts,

    files: state.files,
    fileLoading: state.fileLoading,
    currentDirectory: state.currentDirectory,
    loadRoomFiles,
    uploadFile,
    downloadFile,
    deleteFile,
    createDirectory,
    navigateDirectory
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
