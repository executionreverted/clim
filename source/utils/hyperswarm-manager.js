// source/utils/hyperswarm-manager.js
import Hyperswarm from 'hyperswarm';
import { randomBytes, createHash } from 'crypto';
import { EventEmitter } from 'events';
import { withErrorHandling, logError } from './errorHandler.js';

/**
 * HyperswarmManager - Manages multiple hyperswarm instances for different chat rooms
 * Provides utilities for creating rooms, joining, leaving, and sending data
 */
class HyperswarmManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.rooms = new Map(); // Map of roomId -> { swarm, topic, connections, etc }
    this.defaultOptions = {
      maxPeers: options.maxPeers || 25,
      timeout: options.timeout || 10000, // Connection timeout
      userName: options.userName || 'Anonymous',
      userId: options.userId || this._generateUserId()
    };

    // Track active connections across all rooms
    this.totalConnections = 0;
    this.isDestroyed = false;
  }

  /**
   * Generate a unique user ID
   * @private
   */
  _generateUserId() {
    return randomBytes(8).toString('hex');
  }

  /**
   * Create a topic buffer from a room name
   * @param {string} roomName - Name of the room
   * @returns {Buffer} 32-byte topic buffer
   * @private
   */
  _createTopicFromName(roomName) {
    // Create a deterministic 32-byte topic from the room name
    return createHash('sha256').update(roomName).digest();
  }

  /**
   * Create a message object to send
   * @param {string} type - Message type (e.g., 'chat', 'join', 'leave')
   * @param {object} data - Message payload
   * @returns {Buffer} Message buffer
   * @private
   */
  _createMessage(type, data) {
    const message = {
      type,
      data,
      sender: {
        id: this.defaultOptions.userId,
        name: this.defaultOptions.userName
      },
      timestamp: Date.now()
    };

    return Buffer.from(JSON.stringify(message));
  }

  /**
   * Handle incoming connection from a peer
   * @param {object} roomInfo - Room information object
   * @param {object} conn - Connection object
   * @param {object} info - Peer info object
   * @private
   */
  _handleConnection(roomInfo, conn, info) {
    const peerId = info.publicKey.toString('hex');

    // Add connection to room's connection list
    roomInfo.connections.set(peerId, {
      conn,
      info,
      peerId,
      userName: null, // Will be populated when peer sends JOIN message
      isActive: true,
      connectedAt: Date.now()
    });

    this.totalConnections++;

    // Track when the connection closes
    conn.once('close', () => {
      if (roomInfo.connections.has(peerId)) {
        const peerInfo = roomInfo.connections.get(peerId);
        roomInfo.connections.delete(peerId);
        this.totalConnections--;

        // Emit peer left event
        this.emit('peer:left', {
          roomId: roomInfo.id,
          peerId,
          userName: peerInfo.userName || 'Unknown'
        });
      }
    });

    // Handle incoming messages
    conn.on('data', (data) => {
      try {
        const message = JSON.parse(data.toString());
        const peerInfo = roomInfo.connections.get(peerId);

        // Update peer info if this is a JOIN message
        if (message.type === 'join' && peerInfo) {
          peerInfo.userName = message.sender.name;

          // Emit peer joined event
          this.emit('peer:joined', {
            roomId: roomInfo.id,
            peerId,
            userName: peerInfo.userName
          });
        }

        // Emit the message event to be handled by the app
        this.emit('message', {
          roomId: roomInfo.id,
          peerId,
          message
        });
      } catch (err) {
        logError(err, 'hyperswarm-parse-message');
      }
    });

    // Send our JOIN message to the peer
    this.sendToPeer(roomInfo.id, peerId, 'join', {
      roomId: roomInfo.id
    });
  }

  /**
   * Create or join a room with the given name
   * @param {string} roomName - Name of the room to create/join
   * @param {object} options - Room options
   * @returns {string} Room ID
   */
  joinRoom(roomName, options = {}) {
    if (this.isDestroyed) throw new Error('HyperswarmManager has been destroyed');

    // Generate a deterministic room ID from the name
    const roomId = roomName.toLowerCase().replace(/[^a-z0-9]/g, '-');

    // Check if we're already in this room
    if (this.rooms.has(roomId)) {
      return roomId;
    }

    // Create a new swarm for this room
    const swarm = new Hyperswarm();

    // Create a topic buffer from the room name
    const topic = this._createTopicFromName(roomName);

    // Room information
    const roomInfo = {
      id: roomId,
      name: roomName,
      swarm,
      topic,
      connections: new Map(),
      options: { ...this.defaultOptions, ...options },
      joinedAt: Date.now()
    };

    // Store in our rooms map
    this.rooms.set(roomId, roomInfo);

    // Handle connections
    swarm.on('connection', (conn, info) => {
      this._handleConnection(roomInfo, conn, info);
    });

    // Join the topic - both as a client and a server
    const discovery = swarm.join(topic, {
      server: true,
      client: true
    });

    roomInfo.discovery = discovery;

    // Do an initial flush to connect to available peers
    this._flushConnections(roomId).catch(err => {
      logError(err, 'hyperswarm-join-room');
    });

    // Emit room joined event
    this.emit('room:joined', {
      roomId,
      roomName,
      peersCount: 0
    });

    return roomId;
  }

  /**
   * Leave a room
   * @param {string} roomId - ID of the room to leave
   * @returns {boolean} Success
   */
  async leaveRoom(roomId) {
    if (!this.rooms.has(roomId)) return false;

    const roomInfo = this.rooms.get(roomId);

    try {
      // Send leave messages to all peers
      this.broadcastToRoom(roomId, 'leave', {
        reason: 'user-left'
      });

      // Close all connections
      for (const { conn } of roomInfo.connections.values()) {
        conn.end();
      }

      // Leave the topic
      await roomInfo.swarm.leave(roomInfo.topic);

      // Destroy the swarm
      await roomInfo.swarm.destroy();

      // Remove from our rooms map
      this.rooms.delete(roomId);

      // Emit room left event
      this.emit('room:left', {
        roomId,
        roomName: roomInfo.name
      });

      return true;
    } catch (err) {
      logError(err, 'hyperswarm-leave-room');
      return false;
    }
  }

  /**
   * Send a message to a specific peer in a room
   * @param {string} roomId - ID of the room
   * @param {string} peerId - ID of the peer
   * @param {string} type - Message type
   * @param {object} data - Message data
   * @returns {boolean} Success
   */
  sendToPeer(roomId, peerId, type, data) {
    if (!this.rooms.has(roomId)) return false;

    const roomInfo = this.rooms.get(roomId);

    if (!roomInfo.connections.has(peerId)) return false;

    const { conn } = roomInfo.connections.get(peerId);

    try {
      const message = this._createMessage(type, data);
      conn.write(message);
      return true;
    } catch (err) {
      logError(err, 'hyperswarm-send-to-peer');
      return false;
    }
  }

  /**
   * Broadcast a message to all peers in a room
   * @param {string} roomId - ID of the room
   * @param {string} type - Message type
   * @param {object} data - Message data
   * @returns {number} Number of peers the message was sent to
   */
  broadcastToRoom(roomId, type, data) {
    if (!this.rooms.has(roomId)) return 0;

    const roomInfo = this.rooms.get(roomId);
    let sentCount = 0;

    const message = this._createMessage(type, data);

    for (const { conn } of roomInfo.connections.values()) {
      try {
        conn.write(message);
        sentCount++;
      } catch (err) {
        // Just log individual write errors and continue
        logError(err, 'hyperswarm-broadcast-write');
      }
    }

    return sentCount;
  }

  /**
   * Send a chat message to a room
   * @param {string} roomId - ID of the room
   * @param {string} text - Message text
   * @returns {boolean} Success
   */
  sendChatMessage(roomId, text) {
    return this.broadcastToRoom(roomId, 'chat', { text }) > 0;
  }

  /**
   * Get information about a room
   * @param {string} roomId - ID of the room
   * @returns {object|null} Room information
   */
  getRoomInfo(roomId) {
    if (!this.rooms.has(roomId)) return null;

    const roomInfo = this.rooms.get(roomId);

    return {
      id: roomInfo.id,
      name: roomInfo.name,
      peersCount: roomInfo.connections.size,
      joinedAt: roomInfo.joinedAt,
      peers: Array.from(roomInfo.connections.values()).map(peer => ({
        id: peer.peerId,
        name: peer.userName || 'Unknown',
        connectedAt: peer.connectedAt
      }))
    };
  }

  /**
   * Get information about all rooms
   * @returns {Array} Array of room info objects
   */
  getAllRooms() {
    return Array.from(this.rooms.keys()).map(roomId => this.getRoomInfo(roomId));
  }

  /**
   * Get peers in a room
   * @param {string} roomId - ID of the room
   * @returns {Array} Array of peer info objects
   */
  getPeers(roomId) {
    if (!this.rooms.has(roomId)) return [];

    const roomInfo = this.rooms.get(roomId);

    return Array.from(roomInfo.connections.values()).map(peer => ({
      id: peer.peerId,
      name: peer.userName || 'Unknown',
      connectedAt: peer.connectedAt
    }));
  }

  /**
   * Force a connection flush to find and connect to new peers
   * @param {string} roomId - ID of the room
   * @returns {Promise} Resolves when flush is complete
   */
  async _flushConnections(roomId) {
    if (!this.rooms.has(roomId)) {
      throw new Error(`Room ${roomId} not found`);
    }

    const roomInfo = this.rooms.get(roomId);

    // Announce topic fully
    await roomInfo.discovery.flushed();

    // Connect to any pending peers
    await roomInfo.swarm.flush();

    // Emit updated peer count
    this.emit('room:updated', {
      roomId,
      roomName: roomInfo.name,
      peersCount: roomInfo.connections.size
    });

    return roomInfo.connections.size;
  }

  /**
   * Set user information
   * @param {object} userInfo - User information
   */
  setUserInfo(userInfo) {
    if (userInfo.userName) {
      this.defaultOptions.userName = userInfo.userName;
    }

    if (userInfo.userId) {
      this.defaultOptions.userId = userInfo.userId;
    }
  }

  /**
   * Destroy the manager and all swarm instances
   */
  async destroy() {
    if (this.isDestroyed) return;

    this.isDestroyed = true;

    // Leave all rooms
    const roomIds = Array.from(this.rooms.keys());

    for (const roomId of roomIds) {
      await this.leaveRoom(roomId);
    }

    this.rooms.clear();
    this.removeAllListeners();
  }
}

// Export a function to create the manager with error handling
export function createHyperswarmManager(options = {}) {
  return withErrorHandling(
    () => new HyperswarmManager(options),
    { context: 'hyperswarm-manager-create' }
  )();
}

export default HyperswarmManager;
