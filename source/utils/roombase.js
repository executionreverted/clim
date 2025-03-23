// roombase.js - Room-specific P2P database built on autobase
import Autobase from 'autobase';
import BlindPairing from 'blind-pairing';
import HyperDB from 'hyperdb';
import Hyperswarm from 'hyperswarm';
import ReadyResource from 'ready-resource';
import z32 from 'z32';
import b4a from 'b4a';
import { Router, dispatch } from './spec/hyperdispatch/index.js'
import db from './spec/db/index.js';
import crypto from 'crypto';

/**
 * Class for initiating pairing with a RoomBase
 */
class RoomBasePairer extends ReadyResource {
  constructor(store, invite, opts = {}) {
    super()
    this.store = store
    this.invite = invite
    this.swarm = null
    this.pairing = null
    this.candidate = null
    this.bootstrap = opts.bootstrap || null
    this.onresolve = null
    this.onreject = null
    this.room = null
    this.ready().catch(noop)
  }

  async _open() {
    await this.store.ready()
    this.swarm = new Hyperswarm({
      keyPair: await this.store.createKeyPair('hyperswarm'),
      bootstrap: this.bootstrap
    })

    const store = this.store
    this.swarm.on('connection', (connection, peerInfo) => {
      store.replicate(connection)
    })

    this.pairing = new BlindPairing(this.swarm)
    const core = Autobase.getLocalCore(this.store)
    await core.ready()
    const key = core.key
    await core.close()

    this.candidate = this.pairing.addCandidate({
      invite: z32.decode(this.invite),
      userData: key,
      onadd: async (result) => {
        if (this.room === null) {
          this.room = new RoomBase(this.store, {
            swarm: this.swarm,
            key: result.key,
            encryptionKey: result.encryptionKey,
            bootstrap: this.bootstrap
          })
        }
        this.swarm = null
        this.store = null
        if (this.onresolve) this._whenWritable()
        this.candidate.close().catch(noop)
      }
    })
  }

  _whenWritable() {
    if (this.room.base.writable) return
    const check = () => {
      if (this.room.base.writable) {
        this.room.base.off('update', check)
        this.onresolve(this.room)
      }
    }
    this.room.base.on('update', check)
  }

  async _close() {
    if (this.candidate !== null) {
      await this.candidate.close()
    }

    if (this.swarm !== null) {
      await this.swarm.destroy()
    }

    if (this.store !== null) {
      await this.store.close()
    }

    if (this.onreject) {
      this.onreject(new Error('Pairing closed'))
    } else if (this.room) {
      await this.room.close()
    }
  }

  finished() {
    return new Promise((resolve, reject) => {
      this.onresolve = resolve
      this.onreject = reject
    })
  }
}

/**
 * Main RoomBase class for a single room with p2p messaging
 */
class RoomBase extends ReadyResource {
  constructor(corestore, opts = {}) {
    super()
    this.router = new Router()
    this.store = corestore
    this.swarm = opts.swarm || null
    this.base = null
    this.bootstrap = opts.bootstrap || null
    this.member = null
    this.pairing = null
    this.replicate = opts.replicate !== false

    // Room properties
    this.roomId = opts.roomId || crypto.randomUUID()
    this.roomName = opts.roomName || 'Unnamed Room'
    this.typingUsers = new Set()
    this.messageListeners = []

    // Register command handlers
    this._registerHandlers()

    this._boot(opts)
    this.ready().catch(noop)
  }

  _registerHandlers() {
    // Writer management commands
    this.router.add('@roombase/remove-writer', async (data, context) => {
      await context.base.removeWriter(data.key)
    })

    this.router.add('@roombase/add-writer', async (data, context) => {
      await context.base.addWriter(data.key)
    })

    this.router.add('@roombase/add-invite', async (data, context) => {
      await context.view.insert('@roombase/invite', data)
    })

    // Message commands
    this.router.add('@roombase/send-message', async (data, context) => {
      await context.view.insert('@roombase/messages', data)
    })

    this.router.add('@roombase/delete-message', async (data, context) => {
      await context.view.delete('@roombase/messages', { id: data.id })
    })

    // Typing status command
    this.router.add('@roombase/typing-status', async (data, context) => {
      await context.view.insert('@roombase/typing', data)
    })
  }

  _boot(opts = {}) {
    const { encryptionKey, key } = opts

    this.base = new Autobase(this.store, key, {
      encrypt: true,
      encryptionKey,
      open(store) {
        return HyperDB.bee(store.get('view'), db, {
          extension: false,
          autoUpdate: true
        })
      },
      apply: this._apply.bind(this)
    })

    this.base.on('update', () => {
      if (!this.base._interrupting) {
        this.emit('update')
        this._processIncomingMessages()
      }
    })
  }

  async _apply(nodes, view, base) {
    for (const node of nodes) {
      await this.router.dispatch(node.value, { view, base })
    }
    await view.flush()
  }

  async _open() {
    await this.base.ready()
    if (this.replicate) await this._replicate()

    // Save room info if not already stored
    await this._initializeRoom()
  }

  async _close() {
    if (this.swarm) {
      await this.member.close()
      await this.pairing.close()
      await this.swarm.destroy()
    }

    await this.base.close()
  }

  async _initializeRoom() {
    const existingRoom = await this.getRoomInfo()
    if (!existingRoom) {
      // Store basic room info
      await this.base.view.insert('@roombase/rooms', {
        id: this.roomId,
        name: this.roomName,
        createdAt: Date.now()
      })
    } else {
      // Update local properties from stored values
      this.roomId = existingRoom.id
      this.roomName = existingRoom.name
    }
  }

  _processIncomingMessages() {
    this.getNewMessages().then(messages => {
      if (messages.length > 0) {
        this.emit('new-messages', messages)

        // Notify each listener
        for (const listener of this.messageListeners) {
          try {
            listener(messages)
          } catch (err) {
            console.error('Error in message listener:', err)
          }
        }
      }
    }).catch(noop)
  }

  get writerKey() {
    return this.base.local.key
  }

  get key() {
    return this.base.key
  }

  get discoveryKey() {
    return this.base.discoveryKey
  }

  get encryptionKey() {
    return this.base.encryptionKey
  }

  get writable() {
    return this.base.writable
  }

  static pair(store, invite, opts) {
    return new RoomBasePairer(store, invite, opts)
  }

  async _replicate() {
    await this.base.ready()
    if (this.swarm === null) {
      this.swarm = new Hyperswarm({
        keyPair: await this.store.createKeyPair('hyperswarm'),
        bootstrap: this.bootstrap
      })
      this.swarm.on('connection', (connection, peerInfo) => {
        this.store.replicate(connection)
      })
    }

    this.pairing = new BlindPairing(this.swarm)
    this.member = this.pairing.addMember({
      discoveryKey: this.base.discoveryKey,
      onadd: async (candidate) => {
        try {
          const id = candidate.inviteId
          const inv = await this.base.view.findOne('@roombase/invite', {})
          if (!b4a.equals(inv.id, id)) {
            return
          }

          candidate.open(inv.publicKey)
          await this.addWriter(candidate.userData)
          candidate.confirm({
            key: this.base.key,
            encryptionKey: this.base.encryptionKey
          })
        } catch (err) {
          console.error('Error during pairing acceptance:', err)
        }
      }
    })
    this.swarm.join(this.base.discoveryKey)
  }

  async createInvite(opts = {}) {
    if (this.opened === false) await this.ready()
    const existing = await this.base.view.findOne('@roombase/invite', {})
    if (existing) {
      return z32.encode(existing.invite)
    }

    const { id, invite, publicKey, expires } = BlindPairing.createInvite(this.base.key)
    const record = { id, invite, publicKey, expires }
    await this.base.append(dispatch('@roombase/add-invite', record))
    return z32.encode(record.invite)
  }

  async addWriter(key) {
    await this.base.append(dispatch('@roombase/add-writer', { key: b4a.isBuffer(key) ? key : b4a.from(key) }))
    return true
  }

  async removeWriter(key) {
    await this.base.append(dispatch('@roombase/remove-writer', { key: b4a.isBuffer(key) ? key : b4a.from(key) }))
  }

  // ---------- Message API ----------

  async sendMessage(message) {
    // Make sure base is ready
    await this.base.ready();

    const msg = {
      id: message.id || `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
      content: message.content || '',
      sender: message.sender || 'Unknown',
      publicKey: message.publicKey || (this.base.writerKey ? this.base.writerKey.toString('hex') : null),
      timestamp: message.timestamp || Date.now(),
      system: !!message.system
    };

    try {
      // Use the dispatch function from hyperdispatch for proper message encoding
      const { dispatch } = require('./spec/hyperdispatch');

      // Properly format message for the autobase
      const dispatchData = dispatch('@roombase/send-message', msg);

      // Append to autobase directly - this is critical for persistence
      await this.base.append(dispatchData);

      console.log(`Message ${msg.id} appended to autobase with dispatch`);

      // Emit event for real-time updates
      this.emit('new-message', msg);

      return msg.id;
    } catch (err) {
      console.error(`Error saving message with dispatch:`, err);

      // Fall back to direct view insertion as last resort
      try {
        await this.base.view.insert('@roombase/messages', msg);
        console.log(`Message ${msg.id} inserted directly to view (fallback)`);
        this.emit('new-message', msg);
        return msg.id;
      } catch (innerErr) {
        console.error(`All message saving methods failed:`, innerErr);
        throw new Error(`Failed to persist message: ${err.message}`);
      }
    }
  }

  async deleteMessage(messageId) {
    await this.base.append(dispatch('@roombase/delete-message', { id: messageId }))
    return true
  }

  async setTypingStatus(isTyping) {
    const typing = {
      userId: this.base.writerKey.toString('hex'),
      roomId: this.roomId,
      isTyping,
      timestamp: Date.now()
    }

    await this.base.append(dispatch('@roombase/typing-status', typing))
    return true
  }

  // ---------- Query API with Pagination ----------

  async getRoomInfo() {
    return this.base.view.get('@roombase/rooms', { id: this.roomId })
  }


  /**
   * Get paginated messages with various filtering options
   *
   * @param {Object} opts - Options for fetching messages
   * @param {number} opts.limit - Maximum number of messages to return (default: 20)
   * @param {number} opts.before - Return messages before this timestamp
   * @param {number} opts.after - Return messages after this timestamp
   * @param {string} opts.fromId - Start pagination from this message ID
   * @param {string} opts.beforeId - Get messages before this ID
   * @param {string} opts.sender - Filter messages by sender
   * @param {boolean} opts.reverse - Reverse the sort order (default: true, newest first)
   * @param {boolean} opts.includeMarker - Include pagination marker in response
   * @returns {Object} - Messages and pagination marker
   */
  async getMessages(opts = {}) {
    if (!this.base || !this.base.view) {
      throw new Error("error initializing corestore")
    }

    try {
      // Direct query to view
      const messages$ = await this.base.view.find('@roombase/messages', {});
      const messages = messages$.value
      if (!Array.isArray(messages)) {
        console.warn('Messages not returned as array:', messages);
        return { messages: [] };
      }

      // Sort messages by timestamp
      const sortedMessages = [...messages].sort((a, b) =>
        (opts.reverse === false) ? (a.timestamp - b.timestamp) : (b.timestamp - a.timestamp)
      );

      // Apply any filters from opts
      const filteredMessages = sortedMessages.slice(0, opts.limit || sortedMessages.length);

      console.log(`Retrieved ${filteredMessages.length} messages`);

      return {
        messages: filteredMessages,
        pagination: {
          hasMore: messages.length > filteredMessages.length
        }
      };
    } catch (err) {
      console.error('Error retrieving messages:', err);
      return { messages: [] };
    }
  }
  /**
   * Get messages since a specific timestamp or last read message
   *
   * @param {number|string} since - Timestamp or message ID to get messages after
   * @param {Object} opts - Additional options
   * @param {number} opts.limit - Maximum number of messages to return
   * @param {boolean} opts.onlyUnread - Only return messages not marked as received
   * @returns {Array} - Array of new messages
   */
  async getNewMessages(since = 0, opts = {}) {
    const { limit = 100, onlyUnread = true } = opts

    // Retrieve messages based on what 'since' is
    const allMessages = await this.base.view.find('@roombase/messages', {})

    let filteredMessages

    if (typeof since === 'string') {
      // If 'since' is a string, assume it's a message ID
      const sinceIndex = allMessages.findIndex(msg => msg.id === since)
      if (sinceIndex >= 0) {
        // Get all messages after the specified ID
        filteredMessages = allMessages.slice(sinceIndex + 1)
      } else {
        filteredMessages = allMessages
      }
    } else {
      // If 'since' is a number, assume it's a timestamp
      filteredMessages = allMessages.filter(msg => msg.timestamp > since)
    }

    // Further filter by received status if needed
    if (onlyUnread) {
      filteredMessages = filteredMessages.filter(msg => !msg.received)
    }

    // Sort by timestamp (oldest first)
    filteredMessages.sort((a, b) => a.timestamp - b.timestamp)

    // Apply limit if specified
    if (limit && filteredMessages.length > limit) {
      filteredMessages = filteredMessages.slice(0, limit)
    }

    return filteredMessages
  }

  /**
 * Get all writers with access to this room
 *
 * @param {Object} opts - Query options
 * @param {boolean} opts.includeDetails - Include additional details about writers
 * @param {boolean} opts.includeMetadata - Include metadata about writer activity
 * @returns {Array} - Array of writer information
 */
  async getWriters(opts = {}) {
    const { includeDetails = false, includeMetadata = false } = opts;

    // Get all writer keys who have access to this room
    const writers = [];

    // Add local writer if it exists
    if (this.base?.writerKey) {
      writers.push({
        key: this.base.writerKey.toString('hex'),
        isLocal: true,
        active: true,
        lastSeen: Date.now()
      });
    }

    // Add other writers from base if it exists
    if (this.base?.activeWriters) {
      for (const writer of this.base.activeWriters) {
        if (writer?.core?.key && (!this.base.writerKey || !writer.core.key.equals(this.base.writerKey))) {
          const writerInfo = {
            key: writer.core.key.toString('hex'),
            isLocal: false,
            active: writer.core.length > 0
          };

          if (includeMetadata) {
            try {
              // Safely get messages with error handling
              let messages = [];
              try {
                const result = await this.base.view.find('@roombase/messages', {});
                messages = Array.isArray(result) ? result : [];
              } catch (err) {
                console.error('Error fetching messages for metadata:', err);
                messages = [];
              }

              const writerKey = writerInfo.key;
              const senderMessages = writerKey ?
                messages.filter(msg => msg && msg.sender === writerKey) : [];

              const lastMessage = senderMessages.length > 0 ?
                senderMessages.sort((a, b) => b.timestamp - a.timestamp)[0] : null;

              writerInfo.lastActivity = lastMessage ? lastMessage.timestamp : null;
              writerInfo.messagesCount = senderMessages.length;
            } catch (err) {
              console.error('Error processing message metadata:', err);
              writerInfo.lastActivity = null;
              writerInfo.messagesCount = 0;
            }
          }

          writers.push(writerInfo);
        }
      }
    }

    return writers;
  }  /**
  * Get users who are currently typing in this room
  *
  * @param {Object} opts - Query options
  * @param {number} opts.recentSeconds - Consider typing events within this many seconds (default: 5)
  * @param {boolean} opts.includeTimestamps - Include typing start timestamps
  * @returns {Array|Object} - Array of user IDs or object with typing details
  */
  async getTypingUsers(opts = {}) {
    const { recentSeconds = 5, includeTimestamps = false } = opts
    const allTyping = await this.base.view.find('@roombase/typing', { roomId: this.roomId })

    // Filter to only recent typing updates
    const cutoffTime = Date.now() - (recentSeconds * 1000)
    const typingUsers = allTyping.filter(t =>
      t.timestamp > cutoffTime &&
      t.isTyping &&
      t.userId !== this.base.writerKey.toString('hex')
    )

    if (includeTimestamps) {
      // Return detailed information
      return typingUsers.map(t => ({
        userId: t.userId,
        since: t.timestamp
      }))
    }

    // Return just the user IDs
    return typingUsers.map(t => t.userId)
  }

  // ---------- Event subscription ----------

  onMessage(callback) {
    if (typeof callback === 'function' && !this.messageListeners.includes(callback)) {
      this.messageListeners.push(callback)
    }
    return () => {
      this.messageListeners = this.messageListeners.filter(cb => cb !== callback)
    }
  }

  // Static helpers for managing rooms collection

  /**
   * Create a room info entry in a shared config database
   */
  static async addRoomToCollection(configDb, roomInfo) {
    try {
      const room = {
        id: roomInfo.id,
        name: roomInfo.name,
        key: roomInfo.key,
        encryptionKey: roomInfo.encryptionKey,
        discoveryKey: roomInfo.discoveryKey,
        createdAt: roomInfo.createdAt || Date.now(),
        lastActivity: Date.now()
      }

      await configDb.put(`rooms/${room.id}`, JSON.stringify(room))
      return room.id
    } catch (err) {
      console.error('Failed to add room to collection:', err)
      throw err
    }
  }

  /**
   * Get all rooms from collection
   */
  static async getRoomsFromCollection(configDb) {
    try {
      return new Promise((resolve, reject) => {
        const rooms = []
        configDb.createReadStream({ gt: 'rooms/', lt: 'rooms/\uffff' })
          .on('data', data => {
            try {
              const room = JSON.parse(data.value.toString())
              rooms.push(room)
            } catch (err) {
              console.error('Error parsing room data:', err)
            }
          })
          .on('error', err => reject(err))
          .on('end', () => resolve(rooms))
      })
    } catch (err) {
      console.error('Failed to get rooms from collection:', err)
      return []
    }
  }

  /**
   * Remove room from collection
   */
  static async removeRoomFromCollection(configDb, roomId) {
    try {
      await configDb.del(`rooms/${roomId}`)
      return true
    } catch (err) {
      console.error('Failed to remove room from collection:', err)
      return false
    }
  }

  /**
   * Update room activity timestamp
   */
  static async updateRoomActivity(configDb, roomId) {
    try {
      const roomData = await configDb.get(`rooms/${roomId}`)
      if (roomData) {
        const room = JSON.parse(roomData.toString())
        room.lastActivity = Date.now()
        await configDb.put(`rooms/${roomId}`, JSON.stringify(room))
      }
    } catch (err) {
      console.error('Failed to update room activity:', err)
    }
  }
}

function noop() { }

export default RoomBase
