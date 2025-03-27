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
    this.driveKey = null;
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

  // Improved implementation for the _initializeDrive method in RoomBase class
  // Simplified _initializeDrive method
  async _initializeDrive() {
    try {
      console.log('Initializing drive...');

      // Make sure we have a drive store
      if (!this.driveStore) {
        console.error('No drive store provided');
        return false;
      }

      await this.driveStore.ready();

      // Always try to get drive key from database first
      let driveKeyFromDb = null;

      try {
        // First check room metadata (most reliable source)
        const roomInfo = await this.getRoomInfo();
        if (roomInfo && roomInfo.driveKey) {
          driveKeyFromDb = roomInfo.driveKey;
          console.log(`Found drive key in room metadata: ${driveKeyFromDb}`);
        } else {
          // Fall back to dedicated drive metadata
          const driveMetadata = await this._getDriveMetadata();
          if (driveMetadata && driveMetadata.driveKey) {
            driveKeyFromDb = driveMetadata.driveKey;
            console.log(`Found drive key in drive metadata: ${driveKeyFromDb}`);
          }
        }
      } catch (err) {
        console.warn('Error fetching metadata:', err);
      }

      // Decide whether to create a new drive or use existing key
      if (driveKeyFromDb) {
        // Use the drive key from database
        this.driveKey = driveKeyFromDb;
        console.log(`Using existing drive key from database: ${this.driveKey}`);
      } else if (this.base.writable && !this.driveKey) {
        // If we're the room creator and no drive key exists, create a new drive
        console.log('No drive key found in database and we are room creator - creating new drive');
        this.drive = new Hyperdrive(this.driveStore);
        await this.drive.ready();

        // Store the new drive key
        this.driveKey = this.drive.key.toString('hex');
        console.log(`Created new drive with key: ${this.driveKey}`);

        // Store the drive key in metadata
        await this._storeDriveKey();

        // Drive is already initialized, return success
        await this._setupDriveReplication();
        return true;
      } else if (!this.driveKey) {
        // If we're not the room creator and no drive key is found, wait for it
        console.log('No drive key found and not room creator - cannot initialize drive yet');
        console.log('Will retry after metadata sync');

        // Force an update to get latest metadata
        try {
          await this.base.update({ wait: true });

          // Check again for drive key
          const roomInfo = await this.getRoomInfo();
          if (roomInfo && roomInfo.driveKey) {
            this.driveKey = roomInfo.driveKey;
            console.log(`Found drive key after update: ${this.driveKey}`);
          } else {
            console.error('Still no drive key found after metadata update');
            return false;
          }
        } catch (updateErr) {
          console.error('Error updating metadata:', updateErr);
          return false;
        }
      }

      // Now initialize the drive with the key (either from DB or newly created)
      try {
        if (this.driveKey) {
          // Convert from hex string to Buffer if needed
          const driveKeyBuffer = typeof this.driveKey === 'string'
            ? Buffer.from(this.driveKey, 'hex')
            : this.driveKey;

          console.log(`Opening drive with key: ${this.driveKey}`);
          this.drive = new Hyperdrive(this.driveStore, driveKeyBuffer);
          await this.drive.ready();
          console.log(`Drive ready, key: ${this.drive.key.toString('hex')}`);

          // Verification step
          const actualKey = this.drive.key.toString('hex');
          if (actualKey !== this.driveKey) {
            console.error(`Drive key mismatch! Expected: ${this.driveKey}, Got: ${actualKey}`);

            // Close the drive and try again with correct key
            await this.drive.close();

            // This is a critical error - drive key should match what we requested
            throw new Error('Drive key mismatch');
          }

          // Setup drive replication
          await this._setupDriveReplication();
          return true;
        } else {
          console.error('No drive key available after all attempts');
          return false;
        }
      } catch (err) {
        console.error('Error initializing drive:', err);
        this.drive = null;
        return false;
      }
    } catch (err) {
      console.error('Error in _initializeDrive:', err);
      this.drive = null;
      return false;
    }
  }


  async _setupDriveReplication() {
    if (!this.drive || !this.swarm || !this.driveKey) return;

    try {

      this.driveSwarm = new Hyperswarm()

      this.driveSwarm.on('connection', (socket) => this.drive.replicate(socket))
      // Get the drive's discovery key
      const driveDiscoveryKey = this.drive.discoveryKey;
      // Join the swarm with the drive's discovery key
      this.driveSwarm.join(driveDiscoveryKey, {
        server: true,
        client: true
      });

      // Set up connection handler for drive replication
      this.driveSwarm.on('connection', (connection) => {
        // Replicate the drive with this connection
        this.drive.replicate(connection);

        // Listen for connection close to handle cleanup
        connection.on('close', () => {
          // Handle connection close
          console.log('Drive replication connection closed');
        });

        // Handle connection errors
        connection.on('error', (err) => {
          console.error('Drive replication connection error:', err);
        });
      });
      this.updateDrive()
      console.log('Drive replication set up successfully');
    } catch (err) {
      console.error('Error setting up drive replication:', err);
    }
  }

  async _initializeRoom() {
    // Use a constant ID "metadata" instead of this.roomId for storing room info
    const METADATA_ID = "metadata";

    const existingRoom = await this.getRoomInfo()
    if (!existingRoom) {
      // Store basic room info with constant ID
      const roomMetadata = {
        id: METADATA_ID, // Use constant ID for metadata
        originalRoomId: this.roomId, // Store original ID as a reference
        name: this.roomName,
        createdAt: Date.now(),
        messageCount: 0,
        driveKey: this.driveKey
      }
      try {
        const dispatchData = dispatch('@roombase/set-metadata', roomMetadata);
        await this.base.append(dispatchData)
      } catch (e) {
        console.error('Error initializing room metadata:', e);
      }
    } else {
      // Update local properties from stored values
      // Keep using original roomId for local reference
      this.roomName = existingRoom.name

      if (existingRoom.driveKey && !this.driveKey) {
        this.driveKey = existingRoom.driveKey;
        await this._initializeDrive();
      }

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
    if (!this.driveKey) {
      console.error('Cannot store null drive key');
      return false;
    }

    try {
      console.log(`Storing drive key ${this.driveKey} for room ${this.roomId}`);
      const METADATA_ID = "metadata";
      let success = false;

      // 1. Store in room metadata (primary location) with constant ID
      try {
        // Get existing room info
        const room = await this.getRoomInfo();

        if (room) {
          // Update existing room info with drive key
          const updatedRoom = {
            ...room,
            driveKey: this.driveKey
          };

          console.log('Updating room metadata with drive key');
          const metadataDispatch = dispatch('@roombase/set-metadata', updatedRoom);
          await this.base.append(metadataDispatch);
          success = true;
        } else {
          // Create new room metadata with constant ID
          const newRoom = {
            id: METADATA_ID,
            originalRoomId: this.roomId,
            name: this.roomName || 'Unnamed Room',
            createdAt: Date.now(),
            messageCount: 0,
            driveKey: this.driveKey
          };

          console.log('Creating new room metadata with drive key');
          const metadataDispatch = dispatch('@roombase/set-metadata', newRoom);
          await this.base.append(metadataDispatch);
          success = true;
        }

        // Force an immediate ack to help it spread faster
        try {
          await this.base.ack();
        } catch (ackErr) {
          console.warn('Error during ack:', ackErr);
        }
      } catch (roomErr) {
        console.error('Error storing drive key in room metadata:', roomErr);
      }

      // 2. Also store in dedicated drive metadata as backup
      try {
        // Create or update drive metadata - also use constant ID here
        const metadata = {
          id: METADATA_ID,
          driveKey: this.driveKey,
          createdAt: Date.now()
        };

        console.log('Storing drive key in backup metadata');
        const driveDispatch = dispatch('@roombase/set-drive-key', metadata);
        await this.base.append(driveDispatch);
        success = true;

        // Force an immediate ack
        try {
          await this.base.ack();
        } catch (ackErr) {
          console.warn('Error during ack:', ackErr);
        }
      } catch (driveErr) {
        console.error('Error storing drive key in drive metadata:', driveErr);
      }

      // At this point, if we succeeded with at least one storage method, consider it a success
      if (success) {
        console.log('Drive key stored successfully');
        return true;
      } else {
        console.error('Failed to store drive key in any metadata location');
        return false;
      }
    } catch (err) {
      console.error('Error storing drive key:', err);
      return false;
    }
  }

  // --- Fourth part: Modify the _getDriveMetadata method ---
  async _getDriveMetadata() {
    try {
      const METADATA_ID = "metadata";
      return await this.base.view.get('@roombase/drive-metadata', { id: METADATA_ID });
    } catch (err) {
      console.error('Error getting drive metadata:', err);
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


    this.startPeriodicDriveSync();
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
  async updateMessageCount(roomId) {
    try {
      const METADATA_ID = "metadata";
      const room = await this.getRoomInfo();
      if (!room) return 1;

      // Update room metadata with constant ID
      const updatedRoom = {
        ...room,
        messageCount: (room.messageCount || 0) + 1
      };

      const dispatchData = dispatch('@roombase/set-metadata', updatedRoom);
      await this.base.append(dispatchData);

      return updatedRoom.messageCount;
    } catch (err) {
      console.error('Error updating message count:', err);
      return 1;
    }
  }
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

      // Use constant ID for updating room metadata
      const METADATA_ID = "metadata";
      const room = await this.getRoomInfo();
      if (room) {
        const currentCount = room.messageCount || 0;
        const newCount = currentCount + 1;

        // Update room metadata with new message count
        try {
          const dispatchData = dispatch('@roombase/set-metadata', {
            ...room,
            messageCount: newCount
          });
          await this.base.append(dispatchData);
        } catch (updateErr) {
          console.error("Error updating room count:", updateErr);
        }
      }

      return msg.id;
    } catch (err) {
      console.error(`Error saving message with dispatch:`, err);
      this.emit('mistake', JSON.stringify(err.message))
      return null;
    }
  }

  async deleteMessage(messageId) {
    await this.base.append(dispatch('@roombase/delete-message', { id: messageId }))
    return true
  }

  // ---------- Query API with Pagination ----------

  async getRoomInfo() {
    try {
      // Use constant ID "metadata" instead of this.roomId
      const METADATA_ID = "metadata";
      return await this.base.view.get('@roombase/metadata', { id: METADATA_ID });
    } catch (e) {
      console.error('Error getting room info:', e);
      return null;
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

  async isDownloaded(path) {
    if (!this.drive) return false;

    try {
      return await this.drive.has(path);
    } catch (err) {
      console.error(`Error checking if ${path} is downloaded:`, err);
      return false;
    }
  }

  async getDriveSyncStatus() {
    if (!this.drive) throw new Error('Drive not initialized');

    try {
      // Get drive stats
      const length = this.drive.length;
      const version = this.drive.version;

      // Get peer count from swarm
      let peerCount = 0;
      if (this.swarm) {
        peerCount = this.swarm.connections.size;
      }

      // Estimate drive size by checking a sample of entries
      const rootEntries = await this.getFiles('/', { recursive: false });

      return {
        key: this.driveKey,
        length,
        version,
        peerCount,
        rootFolders: rootEntries.filter(e => e.isDirectory).length,
        rootFiles: rootEntries.filter(e => !e.isDirectory).length,
        lastUpdated: Date.now()
      };
    } catch (err) {
      console.error('Error getting drive sync status:', err);
      return {
        key: this.driveKey,
        error: err.message,
        lastUpdated: Date.now()
      };
    }
  }

  async findDrivePeers() {
    if (!this.drive || !this.swarm) return false;

    try {
      // Creating "finding peers" promise as per Hyperdrive docs
      const done = this.drive.findingPeers();

      // Join the swarm with the drive's discovery key
      const discovery = this.swarm.join(this.drive.discoveryKey);

      // Wait for the topic to be fully announced
      await discovery.flushed();

      // Wait for connections to be established
      await this.swarm.flush();

      // Let Hyperdrive know we're done finding peers
      done();

      return true;
    } catch (err) {
      console.error('Error finding drive peers:', err);
      return false;
    }
  }

  async updateDrive() {
    if (!this.drive) throw new Error('Drive not initialized');

    try {
      // First find peers
      await this.findDrivePeers();

      // Then update with wait option
      const updated = await this.drive.update({ wait: true });

      return updated;
    } catch (err) {
      console.error('Error updating drive:', err);
      return false;
    }
  }

  async getDownloadStatus(path) {
    if (!this.drive) throw new Error('Drive not initialized');

    try {
      const entry = await this.drive.entry(path);
      if (!entry) throw new Error(`Entry not found: ${path}`);

      const isDirectory = !entry.value.blob;

      if (isDirectory) {
        // For directories, check all entries
        const entries = await this.getFiles(path, { recursive: true });
        let totalFiles = 0;
        let downloadedFiles = 0;

        for (const entry of entries) {
          if (!entry.isDirectory) {
            totalFiles++;
            if (await this.drive.has(entry.path)) {
              downloadedFiles++;
            }
          }
        }

        return {
          path,
          isDirectory: true,
          totalFiles,
          downloadedFiles,
          percentage: totalFiles > 0 ? Math.round((downloadedFiles / totalFiles) * 100) : 100
        };
      } else {
        // For single files
        const downloaded = await this.drive.has(path);
        return {
          path,
          isDirectory: false,
          downloaded,
          percentage: downloaded ? 100 : 0
        };
      }
    } catch (err) {
      console.error(`Error getting download status for ${path}:`, err);
      return {
        path,
        error: err.message,
        downloaded: false,
        percentage: 0
      };
    }
  }

  // Simplified getFiles function for a flat structure
  async getFiles(directory = '/', options = {}) {
    if (!this.drive) {
      console.error('Drive not initialized in getFiles');
      return [];
    }


    const { limit = 100 } = options;

    try {
      console.log(`Getting files from drive (flat structure)`);

      const fileEntries = [];

      // Check if drive is ready
      if (!this.drive.ready()) {
        await this.drive.ready();
      }

      // Add error handling for drive.list
      try {
        await this.updateDrive()
        // Always list from root with no recursion
        const stream = this.drive.list('/', { recursive: false });

        if (!stream) {
          console.error('No stream returned from drive.list');
          return [];
        }

        for await (const entry of stream) {
          // Skip directory markers and hidden files
          if (entry.key.endsWith('/') || entry.key.startsWith('.')) continue;

          // Skip if it's a hidden file
          const name = entry.key.split('/').pop();
          if (name && name.startsWith('.')) continue;

          const isDirectory = !entry.value.blob;

          // Skip directories in flat structure
          if (isDirectory) continue;

          // Add file to results
          fileEntries.push({
            ...entry,
            path: entry.key,
            name: name || 'Unknown',
            isDirectory: false,
            size: entry.value.blob ? entry.value.blob.byteLength : 0,
            createdAt: Date.now()
          });

          if (fileEntries.length >= limit) break;
        }
      } catch (listErr) {
        console.error(`Error in drive.list: ${listErr.message}`);
      }

      // Sort by newest first based on timestamp or creation time
      return fileEntries.sort((a, b) => {
        // Sort by timestamp if available
        if (a.value && a.value.metadata && a.value.metadata.timestamp &&
          b.value && b.value.metadata && b.value.metadata.timestamp) {
          return b.value.metadata.timestamp - a.value.metadata.timestamp;
        }
        // Fall back to path comparison if no timestamp
        return a.name.localeCompare(b.name);
      });
    } catch (err) {
      console.error(`Error listing files:`, err);
      return [];
    }
  }

  watchFiles(directory = '/') {
    if (!this.drive) throw new Error('Drive not initialized');

    try {
      // Clean up existing watcher if present
      if (this.driveWatcher) {
        this.driveWatcher.destroy();
      }

      // Normalize directory path
      const dirPath = directory.endsWith('/') ? directory : directory + '/';

      // Create watcher - this returns an async iterator
      // Usage: for await (const [curr, prev] of watcher) { ... }
      this.driveWatcher = this.drive.watch(dirPath);

      // Make watcher available
      return this.driveWatcher;
    } catch (err) {
      console.error(`Error watching directory ${directory}:`, err);
      return null;
    }
  }

  async directoryExists(path) {
    if (!this.drive) return false;

    try {
      // Normalize path to end with / for directory
      const dirPath = path.endsWith('/') ? path : path + '/';

      // Try to list directory with limit 1
      const entries = this.drive.list(dirPath, { limit: 1 });

      // If we can get one entry, the directory exists
      for await (const entry of entries) {
        return true;
      }

      // No entries found
      return false;
    } catch (err) {
      // Most likely the directory doesn't exist
      return false;
    }
  }

  // Simplified uploadFile function for flat structure
  async uploadFile(data, filePath, options = {}) {
    if (!this.drive) {
      console.error('Drive not initialized');
      return null;
    }

    try {
      // Get just the filename without path
      const filename = filePath.includes('/')
        ? filePath.split('/').pop()
        : filePath;

      // Always store files in root with just the filename
      const finalPath = `/${filename}`;

      // Set metadata with timestamp for sorting
      const metadata = {
        ...(options.metadata || {}),
        timestamp: Date.now(),
        originalName: filename
      };

      // Simple executable flag
      const executable = options.executable || false;

      // Upload file to drive in root path
      await this.drive.put(finalPath, data, {
        metadata,
        executable
      });

      // Return file metadata
      return {
        path: finalPath,
        name: filename,
        size: data.length,
        metadata: metadata,
        timestamp: metadata.timestamp
      };
    } catch (err) {
      console.error(`Error uploading file:`, err);
      return null;
    }
  }
  async downloadFile(filePath, options = {}) {
    if (!this.drive) throw new Error('Drive not initialized');

    const { maxSize = 10 * 1024 * 1024, timeout = 30000 } = options; // Default to 10MB max, 30s timeout

    try {
      // Check if file exists
      const fileExists = await this.drive.exists(filePath);
      if (!fileExists) throw new Error(`File does not exist: ${filePath}`);

      // Get file entry to determine size
      const entry = await this.drive.entry(filePath);
      if (!entry) throw new Error('Unable to get file entry');

      const fileSize = entry.value?.blob?.byteLength || 0;

      // For very large files, implement chunked download
      if (fileSize > maxSize) {
        console.warn(`Large file detected (${fileSize} bytes). Loading first ${maxSize} bytes.`);

        // Create a read stream with limits
        const stream = this.drive.createReadStream(filePath, {
          start: 0,
          end: maxSize - 1,
          wait: true,
          timeout
        });

        // Collect chunks into a buffer
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }

        const buffer = Buffer.concat(chunks);
        return buffer;
      }

      // For smaller files, use get with wait and timeout options
      return await this.drive.get(filePath, { wait: true, timeout });
    } catch (err) {
      console.error(`Error downloading file from ${filePath}:`, err);
      return null;
    }
  }

  async createDirectory(dirPath) {
    if (!this.drive) throw new Error('Drive not initialized');

    try {
      // Normalize path to ensure it ends with /
      const normalizedPath = dirPath.endsWith('/') ? dirPath : dirPath + '/';

      // According to Hyperdrive documentation, directories are just paths that end with /
      // We create an empty file to represent the directory
      const markerPath = normalizedPath + '.hyperdrive-dir';

      // Create the directory marker file
      await this.drive.put(markerPath, Buffer.from(''), {
        metadata: {
          type: 'directory-marker',
          created: Date.now()
        }
      });

      return true;
    } catch (err) {
      console.error(`Error creating directory at ${dirPath}:`, err);
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

  /**
 * Delete a file or directory from the drive
 * @param {string} path - Path to delete
 * @returns {Promise<boolean>} Success status
 */
  async deleteFile(filePath) {
    if (!this.drive) throw new Error('Drive not initialized');

    try {
      // Check if the file exists
      const exists = await this.drive.exists(filePath);
      if (!exists) throw new Error(`File not found: ${filePath}`);

      // Get the entry to determine if it's a file or directory
      const entry = await this.drive.entry(filePath);
      const isDirectory = !entry?.value?.blob;

      if (isDirectory) {
        // If it's a directory (path ends with /), delete all contents
        return await this.deleteDirectory(filePath);
      } else {
        // Delete single file
        await this.drive.del(filePath);
        return true;
      }
    } catch (err) {
      console.error(`Error deleting ${filePath}:`, err);
      return false;
    }
  }
  async deleteDirectory(dirPath) {
    if (!this.drive) throw new Error('Drive not initialized');

    try {
      // Normalize path to ensure it ends with /
      const normalizedPath = dirPath.endsWith('/') ? dirPath : dirPath + '/';

      // Get all entries in this directory
      const entries = await this.getFiles(normalizedPath, { recursive: true });

      // Delete all entries (files first, then directories)
      // Sort in reverse order to delete deeper paths first
      const sortedEntries = entries.sort((a, b) => b.path.length - a.path.length);

      for (const entry of sortedEntries) {
        try {
          await this.drive.del(entry.path);
        } catch (err) {
          console.error(`Error deleting entry ${entry.path}:`, err);
          // Continue with other entries
        }
      }

      // Delete the directory marker if it exists
      try {
        await this.drive.del(normalizedPath + '.hyperdrive-dir');
      } catch (e) {
        // Ignore errors if marker doesn't exist
      }

      return true;
    } catch (err) {
      console.error(`Error deleting directory ${dirPath}:`, err);
      return false;
    }
  }


  // Improved static joinRoom function for better drive handling
  static async joinRoom(store, inviteCode, opts = {}) {
    if (!store) {
      throw new Error('Corestore is required');
    }

    if (!inviteCode) {
      throw new Error('Invite code is required');
    }

    console.log(`Joining room with invite code: ${inviteCode}`);

    try {
      // Create pairing instance
      const pair = RoomBase.pair(store, inviteCode, opts);

      // Wait for pairing to complete
      const room = await pair.finished();
      console.log('Pairing completed successfully');

      // Wait for room to be fully ready
      await room.ready();
      console.log('Room is ready');

      // Force an update to get the latest metadata
      try {
        await room.base.update({ wait: true });
        console.log('Base updated with latest metadata');

        // Get room info with constant ID to ensure we get the correct metadata
        const roomInfo = await room.getRoomInfo();
        if (roomInfo) {
          // Update the room name from metadata
          room.roomName = roomInfo.name || room.roomName;

          // If room has an original ID, use it
          if (roomInfo.originalRoomId) {
            room.roomId = roomInfo.originalRoomId;
          }

          console.log(`Synced room metadata: name=${room.roomName}, id=${room.roomId}`);
        }
      } catch (updateErr) {
        console.warn('Error updating base:', updateErr);
        // Continue anyway - we'll try to get drive info next
      }

      // Try to initialize the drive using existing key from metadata
      const driveInitResult = await room._initializeDrive();
      console.log(`Drive initialization result: ${driveInitResult ? 'success' : 'waiting for metadata'}`);

      // If drive initialization failed, it might be because we need to wait for metadata
      if (!driveInitResult) {
        console.log('Initial drive initialization failed, will retry after room sync');
        // We can still return the room - drive will be initialized later when metadata is available

        // Start periodic drive sync with shorter interval for quicker initial connection
        room.startPeriodicDriveSync(10000); // Check every 10 seconds initially
      }

      return room;
    } catch (err) {
      console.error('Error joining room:', err);
      throw err;
    }
  }


  startPeriodicDriveSync(intervalMs = 30000) {
    // Clear any existing sync interval
    if (this._driveSyncInterval) {
      clearInterval(this._driveSyncInterval);
    }

    // Set up new sync interval - run syncDrive periodically
    this._driveSyncInterval = setInterval(async () => {
      try {
        // Only try to sync if we don't have a drive yet or haven't accessed it recently
        const needsSync = !this.drive || (Date.now() - (this._lastDriveAccess || 0) > intervalMs);

        if (needsSync) {
          console.log('Running periodic drive sync...');
          await this.syncDrive();
        }
      } catch (err) {
        console.error('Error in periodic drive sync:', err);
      }
    }, intervalMs);

    // Return the interval ID for potential cancellation
    return this._driveSyncInterval;
  }

  // Add this method to stop periodic syncing
  stopPeriodicDriveSync() {
    if (this._driveSyncInterval) {
      clearInterval(this._driveSyncInterval);
      this._driveSyncInterval = null;
      return true;
    }
    return false;
  }

  // Track drive accesses to optimize sync frequency
  _trackDriveAccess() {
    this._lastDriveAccess = Date.now();
  }

  async syncDrive() {
    // Skip if we already have a working drive
    if (this.drive) {
      console.log('Drive already initialized, checking for updates');
      try {
        await this.drive.update({ wait: true });
        console.log('Drive updated');
        return true;
      } catch (updateErr) {
        console.warn('Error updating drive:', updateErr);
      }
    }

    try {
      // Force an update to get the latest metadata
      await this.base.update({ wait: true });

      // Get the latest room info to see if drive key is available
      const roomInfo = await this.getRoomInfo();

      if (roomInfo && roomInfo.driveKey) {
        console.log(`Found drive key in room metadata: ${roomInfo.driveKey}`);

        // Only update our drive key if it's different
        if (this.driveKey !== roomInfo.driveKey) {
          console.log(`Updating drive key from ${this.driveKey} to ${roomInfo.driveKey}`);
          this.driveKey = roomInfo.driveKey;
        }

        // If we don't have a drive yet, initialize it
        if (!this.drive) {
          console.log('Initializing drive with key from metadata');
          const success = await this._initializeDrive();

          if (!success) {
            console.error('Failed to initialize drive with key from metadata');
            return false;
          }

          console.log('Drive initialized successfully');
          return true;
        }

        return true;
      } else {
        console.log('No drive key found in metadata');

        // If we're the room creator, we can create a drive
        if (this.base.writable && !this.drive && !this.driveKey) {
          console.log('We are room creator, creating new drive');
          const success = await this._initializeDrive();
          return success;
        }

        return false;
      }
    } catch (err) {
      console.error('Error syncing drive:', err);
      return false;
    }
  }
}
function noop() { }

export default RoomBase
