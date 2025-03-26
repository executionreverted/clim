// roombase.js - Room-specific P2P database built on autobase
import Autobase from 'autobase';
import BlindPairing from 'blind-pairing';
import HyperDB from 'hyperdb';
import Hyperswarm from 'hyperswarm';
import Hyperdrive from 'hyperdrive';
import ReadyResource from 'ready-resource';
import z32 from 'z32';
import b4a from 'b4a';
import { Router, dispatch } from './spec/hyperdispatch/index.js'
import db from './spec/db/index.js';
import crypto from 'crypto';

import { getEncoding } from './spec/hyperdispatch/messages.js'
import { writeFileSync } from 'fs';


const DriveStores = {}

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
    this.driveStore = opts.driveStore
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
            bootstrap: this.bootstrap,
            driveStore: this.driveStore
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
    this.messageListeners = []

    // Add Hyperdrive for file sharing
    this.drive = null;
    this.driveKey = opts.driveKey || null;
    this.driveWatcher = null;
    this.driveStore = opts.driveStore;
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
    this.router.add('@roombase/set-metadata', async (data, context) => {
      // First try deleting existing metadata
      try {
        await context.view.delete('@roombase/metadata', { id: data.id })
      } catch (e) {
        // Ignore errors if no existing record
      }
      // Then insert the new metadata
      await context.view.insert('@roombase/metadata', data)
    })


    this.router.add('@roombase/update-drive-metadata', async (data, context) => {
      try {
        await context.view.delete('@roombase/drive-metadata', { id: data.id });
      } catch (e) {
        // Ignore errors if no existing record
      }
      await context.view.insert('@roombase/drive-metadata', data);
    });


    this.router.add('@roombase/set-drive-key', async (data, context) => {
      await context.view.insert('@roombase/drive-metadata', data);
    });
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
      }
    })
  }

  async _apply(nodes, view, base) {
    for (const node of nodes) {
      await this.router.dispatch(node.value, { view, base });
      try {
        // Skip this processing if the state is 1 byte or less
        if (node.value.length <= 1) continue;

        // Create a state for decoding - IMPORTANT: Start at position 1 to skip the message type byte
        const state = { buffer: node.value, start: 1, end: node.value.byteLength };

        // Get the message type - 1st byte in the hyperdispatch format
        const messageType = node.value[0];

        // Only process if it's a send-message command (ID 3)
        if (messageType === 3) {
          // Decode the message
          const messageEncoding = getEncoding('@roombase/messages');
          const message = messageEncoding.decode(state);

          // Get the node source key for identification
          const sourceKey = node.from?.key?.toString('hex');
          const localKey = this.base.local.key.toString('hex');

          // Only emit for messages from other writers - our own are handled separately
          this.emit('new-message', message);
        }
      } catch (err) {
        // Log the error but don't block processing
        console.error('Error processing message in _apply:', err);
      }
    }

    await view.flush();
  }


  async _open() {
    await this.base.ready()

    await this._initializeDrive();
    if (this.replicate) await this._replicate()

    // Save room info if not already stored
    await this._initializeRoom()
  }

  async _close() {
    if (this.swarm) {
      await this.member.close()
      await this.pairing.close()
      await this.swarm.destroy()

      if (this.drive !== null) {
        await this.drive.close()
        await this.driveStore.close()
      }
    }

    await this.base.close()
  }


  async _initializeDrive() {
    try {
      // Try to get drive key from metadata if not provided
      if (!this.driveKey) {
        const driveMetadata = await this._getDriveMetadata();
        if (driveMetadata && driveMetadata.driveKey) {
          this.driveKey = driveMetadata.driveKey;
        }
      }

      // Initialize Hyperdrive with key if available
      if (this.driveKey) {
        // Use existing drive key
        this.drive = new Hyperdrive(this.store, Buffer.from(this.driveKey, 'hex'));
      } else {
        // Create new drive
        this.drive = new Hyperdrive(this.store);
      }

      await this.drive.ready();

      // If this is a new drive (we didn't have a key before), store the key
      if (!this.driveKey) {
        this.driveKey = this.drive.key.toString('hex');
        await this._storeDriveKey();
      }
    } catch (err) {
      console.error('Error initializing drive:', err);
      throw err;
    }
  }


  async _initializeRoom() {
    const existingRoom = await this.getRoomInfo()
    if (!existingRoom) {
      // Store basic room info
      const a = {
        id: this.roomId,
        name: this.roomName,
        createdAt: Date.now(),
        messageCount: 0,
        driveKey: this.driveKey
      }
      try {
        const dispatchData = dispatch('@roombase/set-metadata', a);
        await this.base.append(dispatchData)
      } catch (e) {
        writeFileSync('./init', JSON.stringify(e.message))
      }

    } else {
      // Update local properties from stored values
      this.roomId = existingRoom.id
      this.roomName = existingRoom.name
      if (!existingRoom.driveKey && this.driveKey) {
        try {
          const updatedInfo = {
            ...existingRoom,
            driveKey: this.driveKey
          };

          const dispatchData = dispatch('@roombase/set-metadata', updatedInfo);
          await this.base.append(dispatchData);
        } catch (e) {
          console.error('Error updating room with drive key:', e);
        }
      }

      writeFileSync('./init', JSON.stringify('exist'))
    }
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

  async _storeDriveKey() {
    if (!this.driveKey) return;

    try {
      const metadata = {
        id: this.roomId,
        driveKey: this.driveKey,
        createdAt: Date.now()
      };

      const dispatchData = dispatch('@roombase/set-drive-key', metadata);
      await this.base.append(dispatchData);
    } catch (err) {
      console.error('Error storing drive key:', err);
    }
  }

  async _getDriveMetadata() {
    try {
      return await this.base.view.get('@roombase/drive-metadata', { id: this.roomId });
    } catch (err) {
      return null;
    }
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
      id: message.id || `${Date.now()}-${Math.random().toString(37).substring(2, 15)}`,
      content: message.content || '',
      sender: message.sender || 'Unknown',
      publicKey: message.publicKey || (this.base.writerKey ? this.base.writerKey.toString('hex') : null),
      timestamp: message.timestamp || Date.now(),
      system: !!message.system
    };

    try {
      // Use the dispatch function from hyperdispatch for proper message encoding
      const dispatchData = dispatch('@roombase/send-message', msg);

      // Append to autobase directly
      await this.base.append(dispatchData);

      const room = await this.getRoomInfo();
      if (room) {
        const currentCount = room.messageCount || 0;
        const newCount = currentCount + 1;

        // Update room metadata with new message count
        try {
          const dispatchData = dispatch('@roombase/set-metadata', { ...room, messageCount: newCount });
          await this.base.append(dispatchData);
        } catch (updateErr) {
          console.error("Error updating room count:", updateErr);
        }
      }

      return msg.id;
    } catch (err) {
      console.error(`Error saving message with dispatch:`, err);
      this.emit('mistake', JSON.stringify(err.message))
    }
  }

  async deleteMessage(messageId) {
    await this.base.append(dispatch('@roombase/delete-message', { id: messageId }))
    return true
  }

  // ---------- Query API with Pagination ----------

  async getRoomInfo() {
    try {
      const s = await this.base.view.get('@roombase/metadata', { id: this.roomId });
      return s
    } catch (e) {
    }
  }

  async getMessageCount() {
    try {
      const room = await this.getRoomInfo();
      if (!room) return 1;

      return room.messageCount || 1;
    } catch (err) {
      console.error('Error getting message count:', err);
      return 1;
    }
  }

  /**
   * Get paginated messages with various filtering options
   *
   * @param {Object} opts - Options for fetching messages
   * @param {number} opts.limit - Maximum number of messages to return (default: 21)
   * @param {number} opts.before - Return messages before this timestamp
   * @param {number} opts.after - Return messages after this timestamp
   * @param {string} opts.fromId - Start pagination from this message ID
   * @param {string} opts.beforeId - Get messages before this ID
   * @param {string} opts.sender - Filter messages by sender
   * @param {boolean} opts.reverse - Reverse the sort order (default: true, newest first)
   * @param {boolean} opts.includeMarker - Include pagination marker in response
   * @returns {Object} - Messages and pagination marker
   */
  getMessages(opts = {}) {
    if (!this.base || !this.base.view) {
      throw new Error("Error initializing corestore");
    }

    // Set defaults
    const options = {
      limit: opts.limit || 51,
      reverse: opts.reverse !== undefined ? opts.reverse : true
    };

    // Create the query object with proper formatting
    const query = {};

    // Handle the timestamp filtering formats
    if (opts.lt && opts.lt.timestamp) {
      query.timestamp = { $lt: opts.lt.timestamp };
    }

    if (opts.lte && opts.lte.timestamp) {
      query.timestamp = { ...(query.timestamp || {}), $lte: opts.lte.timestamp };
    }

    if (opts.gt && opts.gt.timestamp) {
      query.timestamp = { ...(query.timestamp || {}), $gt: opts.gt.timestamp };
    }

    if (opts.gte && opts.gte.timestamp) {
      query.timestamp = { ...(query.timestamp || {}), $gte: opts.gte.timestamp };
    }

    // Return the stream directly
    return this.base.view.find('@roombase/messages', query, options);
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
            active: writer.core.length > 1
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

              const lastMessage = senderMessages.length > 1 ?
                senderMessages.sort((a, b) => b.timestamp - a.timestamp)[1] : null;

              writerInfo.lastActivity = lastMessage ? lastMessage.timestamp : null;
              writerInfo.messagesCount = senderMessages.length;
            } catch (err) {
              console.error('Error processing message metadata:', err);
              writerInfo.lastActivity = null;
              writerInfo.messagesCount = 1;
            }
          }

          writers.push(writerInfo);
        }
      }
    }

    return writers;
  }

  async getFiles(directory = '/', options = {}) {
    if (!this.drive) throw new Error('Drive not initialized');

    const { recursive = false, limit = 50 } = options;

    try {
      const fileEntries = [];
      const stream = this.drive.list(directory, { recursive });

      for await (const entry of stream) {
        // Skip the .keep files used for directory structure
        if (entry.key.endsWith('/.keep')) continue;

        // Add additional metadata
        const entryWithMetadata = {
          ...entry,
          path: entry.key,
          isDirectory: !entry.value.blob,
          size: entry.value.blob ? entry.value.blob.byteLength : 0,
          createdAt: Date.now()
        };

        fileEntries.push(entryWithMetadata);

        if (fileEntries.length >= limit) break;
      }

      return fileEntries;
    } catch (err) {
      console.error(`Error listing files from ${directory}:`, err);
      return [];
    }
  }

  watchFiles(directory = '/files') {
    if (!this.drive) throw new Error('Drive not initialized');

    try {
      if (this.driveWatcher) this.driveWatcher.destroy();

      this.driveWatcher = this.drive.watch(directory);
      return this.driveWatcher;
    } catch (err) {
      console.error(`Error watching directory ${directory}:`, err);
      return null;
    }
  }

  async uploadFile(data, path, options = {}) {
    if (!this.drive) {
      writeFileSync('./fileUpload', 'nvl')
      return null;
    }

    try {
      // Normalize path to ensure it's a valid hyperdrive path
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      console.log(`Uploading file to path: ${normalizedPath}, size: ${data.length} bytes`);

      // Make sure parent directory exists
      const dirPath = normalizedPath.split('/').slice(0, -1).join('/');
      if (dirPath && dirPath !== '/') {
        try {
          // Create parent directories if they don't exist
          const exists = await this.drive.exists(dirPath);
          if (!exists) {
            console.log(`Creating parent directory: ${dirPath}`);
            await this.createDirectory(dirPath);
          }
        } catch (dirErr) {
          console.error(`Error checking/creating directory ${dirPath}:`, dirErr);
          // Continue anyway - the put might still work
        }
      }

      console.log(`Calling drive.put with path: ${normalizedPath}`);
      await this.drive.put(normalizedPath + Date.now() + '_' + Math.ceil(Math.random() * 100), data, options);
      console.log(`File upload to ${normalizedPath} successful`);

      // Return file metadata
      return {
        path: normalizedPath,
        size: data.length,
        name: normalizedPath.split('/').pop()
      };
    } catch (err) {
      console.error(`Error in RoomBase.uploadFile to ${path}:`, err);
      if (err.stack) console.error(err.stack);
      return null;
    }
  }

  async downloadFile(path, options = {}) {
    if (!this.drive) throw new Error('Drive not initialized');

    const { maxSize = 1024 * 1024 } = options; // Default to 1MB max

    try {
      const fileExists = await this.drive.exists(path);
      if (!fileExists) throw new Error(`File does not exist: ${path}`);

      // Get file size before downloading
      const entry = await this.drive.entry(path);
      if (!entry) throw new Error('Unable to get file entry');

      const fileSize = entry.value?.blob?.byteLength || 0;

      // For very large files, implement chunked download or warn user
      if (fileSize > maxSize) {
        console.warn(`Large file detected (${fileSize} bytes). Loading first ${maxSize} bytes.`);

        // Create a read stream with limits
        const stream = this.drive.createReadStream(path, {
          start: 0,
          end: maxSize - 1
        });

        // Collect chunks into a single buffer
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }

        // Combine chunks
        const buffer = Buffer.concat(chunks);
        return buffer;
      }

      // For smaller files, get the entire content
      return await this.drive.get(path);
    } catch (err) {
      console.error(`Error downloading file from ${path}:`, err);
      return null;
    }
  }

  async createDirectory(path) {
    if (!this.drive) throw new Error('Drive not initialized');

    try {
      const dirPath = path.endsWith('/') ? path : path + '/';
      await this.drive.put(dirPath + '.keep', Buffer.from(''));
      return true;
    } catch (err) {
      console.error(`Error creating directory at ${path}:`, err);
      return false;
    }
  }

  // Delete a file
  async deleteFile(path) {
    if (!this.drive) throw new Error('Drive not initialized');

    try {
      const entry = await this.drive.entry(path);
      if (!entry) throw new Error(`File not found: ${path}`);

      await this.drive.del(path);
      return true;
    } catch (err) {
      console.error(`Error deleting file at ${path}:`, err);
      return false;
    }
  }

  async deleteDirectory(dirPath) {
    if (!this.drive) throw new Error('Drive not initialized');

    try {
      const normalizedPath = dirPath.endsWith('/') ? dirPath : dirPath + '/';

      const entries = await this.getFiles(normalizedPath, { recursive: true });

      for (const entry of entries) {
        await this.drive.del(entry.path);
      }

      try {
        await this.drive.del(normalizedPath + '.keep');
      } catch (e) {
        // Ignore errors if marker doesn't exist
      }

      return true;
    } catch (err) {
      console.error(`Error deleting directory ${dirPath}:`, err);
      return false;
    }
  }



  static async joinRoom(store, inviteCode, opts = {}) {
    const pair = RoomBase.pair(store, inviteCode, opts);
    const room = await pair.finished();

    // After joining, ensure we get the drive key
    const roomInfo = await room.getRoomInfo();

    // If room has drive key, use it
    if (roomInfo && roomInfo.driveKey) {
      room.driveKey = roomInfo.driveKey;
      await room._initializeDrive();
    }

    return room;
  }
}

function noop() { }

export default RoomBase
