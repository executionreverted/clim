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
import path from 'path'
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
          console.log(`Using existing drive key from metadata: ${this.driveKey}`);
        }
      }

      // Create drive store directory if it doesn't exist
      if (this.driveStore && !this.driveStore.path) {
        console.error('Drive store missing path property, this may cause issues');
      }

      // Initialize Hyperdrive with key if available
      if (this.driveKey) {
        // Convert from hex string to Buffer if needed
        const driveKeyBuffer = typeof this.driveKey === 'string'
          ? Buffer.from(this.driveKey, 'hex')
          : this.driveKey;

        console.log(`Initializing drive with existing key: ${this.driveKey}`);
        try {
          this.drive = new Hyperdrive(this.driveStore, driveKeyBuffer);
        } catch (driveErr) {
          console.error('Error creating drive with key:', driveErr);
          // Fall back to creating a new drive
          this.drive = new Hyperdrive(this.driveStore);
        }
      } else {
        // Create new drive
        console.log('Creating new hyperdrive');
        this.drive = new Hyperdrive(this.driveStore);
      }

      await this.drive.ready();
      console.log(`Drive ready, key: ${this.drive.key.toString('hex')}`);

      // If this is a new drive (we didn't have a key before), store the key
      if (!this.driveKey) {
        this.driveKey = this.drive.key.toString('hex');
        console.log(`New drive created with key: ${this.driveKey}`);
        await this._storeDriveKey();
      }

      // Create root folders for better organization
      await this._ensureRootFolders();

      return true;
    } catch (err) {
      console.error('Error initializing drive:', err);
      this.drive = null; // Clear reference on failure
      return false;
    }
  }

  // Helper to ensure root folders exist
  async _ensureRootFolders() {
    if (!this.drive) return;

    const rootFolders = ['/files', '/images', '/documents'];

    for (const folder of rootFolders) {
      try {
        // Check if folder exists by checking directory marker
        const exists = await this.drive.exists(folder + '/.hyperdrive-dir');

        if (!exists) {
          await this.createDirectory(folder);
          console.log(`Created root folder: ${folder}`);
        }
      } catch (err) {
        console.error(`Error creating root folder ${folder}:`, err);
        // Continue with other folders
      }
    }
  }

  async _setupDriveReplication() {
    if (!this.drive || !this.swarm) return;

    try {

      this.driveSwarm = new Hyperswarm()

      this.driveSwarm.on('connection', (socket) => drive.replicate(socket))
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

      console.log('Drive replication set up successfully');
    } catch (err) {
      console.error('Error setting up drive replication:', err);
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
    if (!this.driveKey) {
      console.error('Cannot store null drive key');
      return false;
    }

    try {
      const metadata = {
        id: this.roomId,
        driveKey: this.driveKey,
        createdAt: Date.now()
      };

      console.log(`Storing drive key ${this.driveKey} for room ${this.roomId}`);
      const dispatchData = dispatch('@roombase/set-drive-key', metadata);
      await this.base.append(dispatchData);

      // Also update room metadata with drive key
      const room = await this.getRoomInfo();
      if (room) {
        const updatedRoom = {
          ...room,
          driveKey: this.driveKey
        };

        const metadataDispatch = dispatch('@roombase/set-metadata', updatedRoom);
        await this.base.append(metadataDispatch);
      }

      return true;
    } catch (err) {
      console.error('Error storing drive key:', err);
      return false;
    }
  }

  async _getDriveMetadata() {
    try {
      return await this.base.view.get('@roombase/drive-metadata', { id: this.roomId });
    } catch (err) {
      writeFileSync('./getDriveMeta', JSON.stringify(err.message))
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
    await this._setupDriveReplication()
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

  async getFiles(directory = '/', options = {}) {
    if (!this.drive) throw new Error('Drive not initialized');

    const { recursive = false, limit = 50, includeStats = true } = options;

    try {
      // Ensure directory path ends with /
      const dirPath = directory.endsWith('/') ? directory : directory + '/';

      const fileEntries = [];
      const stream = this.drive.list(dirPath, { recursive });

      for await (const entry of stream) {
        // Skip the dotfiles used for directory structure
        if (path.basename(entry.key).startsWith('.')) continue;

        // Extract path info
        const relativePath = entry.key.startsWith(dirPath)
          ? entry.key.slice(dirPath.length)
          : entry.key;

        // Skip empty entries
        if (!relativePath && entry.key !== dirPath) continue;

        // Determine if entry is a directory (no blob means directory)
        const isDirectory = !entry.value.blob;

        // Add enhanced metadata
        const entryWithMetadata = {
          ...entry,
          path: entry.key,
          relativePath,
          name: path.basename(entry.key),
          isDirectory,
          size: entry.value.blob ? entry.value.blob.byteLength : 0,
          createdAt: Date.now() // Hyperdrive doesn't store creation timestamps
        };

        // Get additional stats if requested
        if (includeStats && !isDirectory) {
          try {
            // Get entry stats if available
            const blobInfo = entry.value.blob;
            if (blobInfo) {
              entryWithMetadata.byteLength = blobInfo.byteLength;
            }
          } catch (statErr) {
            console.error(`Error getting stats for ${entry.key}:`, statErr);
          }
        }

        fileEntries.push(entryWithMetadata);

        if (fileEntries.length >= limit) break;
      }

      // Sort entries: directories first, then files alphabetically
      return fileEntries.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
    } catch (err) {
      writeFileSync('./roombaseloadfiles', JSON.stringify(err.message))
      console.error(`Error listing files from ${directory}:`, err);
      return [];
    }
  }

  watchFiles(directory = '/files') {
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

  async uploadFile(data, filePath, options = {}) {
    if (!this.drive) {
      console.error('Drive not initialized');
      return null;
    }

    try {
      // Normalize path to ensure it's a valid hyperdrive path
      const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`;

      // Extract directory path and ensure it exists
      const dirPath = path.dirname(normalizedPath);
      if (dirPath && dirPath !== '/') {
        // Create parent directories if they don't exist
        const exists = await this.directoryExists(dirPath);
        if (!exists) {
          await this.createDirectory(dirPath);
        }
      }

      // Set metadata if provided
      const metadata = options.metadata || null;
      const executable = options.executable || false;

      // Prepare options for put
      const putOptions = {
        metadata,
        executable
      };

      // Upload file to drive
      await this.drive.put(normalizedPath, data, putOptions);

      // Get entry to return accurate metadata
      const entry = await this.drive.entry(normalizedPath);

      // Return file metadata
      return {
        path: normalizedPath,
        name: path.basename(normalizedPath),
        size: data.length,
        byteLength: entry?.value?.blob?.byteLength || data.length,
        metadata: metadata,
        executable: executable,
        timestamp: Date.now()
      };
    } catch (err) {
      console.error(`Error uploading file to ${filePath}:`, err);
      if (err.stack) console.error(err.stack);
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
