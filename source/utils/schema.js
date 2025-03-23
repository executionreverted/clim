const Hyperschema = require('hyperschema')
const HyperdbBuilder = require('hyperdb/builder')
const Hyperdispatch = require('hyperdispatch')

// SCHEMA CREATION START //
const roombase = Hyperschema.from('./spec/schema')
const template = roombase.namespace('roombase')

// Base schemas for writer management
template.register({
  name: 'writer',
  compact: false,
  fields: [{
    name: 'key',
    type: 'buffer',
    required: true
  }]
})

template.register({
  name: 'invite',
  compact: false,
  fields: [{
    name: 'id',
    type: 'buffer',
    required: true
  }, {
    name: 'invite',
    type: 'buffer',
    required: true
  }, {
    name: 'publicKey',
    type: 'buffer',
    required: true
  }, {
    name: 'expires',
    type: 'int',
    required: true
  }]
})

// Room schema - simple structure focusing on room metadata
template.register({
  name: 'rooms',
  compact: false,
  fields: [{
    name: 'id',
    type: 'string',
    required: true
  }, {
    name: 'name',
    type: 'string',
    required: true
  }, {
    name: 'createdAt',
    type: 'int',
    required: true
  }]
})

// Message schema - matches application's message structure exactly
template.register({
  name: 'messages',
  compact: false,
  fields: [{
    name: 'id',
    type: 'string',
    required: true
  }, {
    name: 'content',
    type: 'string',
    required: true
  }, {
    name: 'sender',
    type: 'string',
    required: true
  }, {
    name: 'timestamp',
    type: 'int',
    required: true
  }, {
    name: 'system',
    type: 'boolean',
    required: false
  }, {
    name: 'received',
    type: 'boolean',
    required: false
  }]
})

// Typing status schema
template.register({
  name: 'typing',
  compact: false,
  fields: [{
    name: 'userId',
    type: 'string',
    required: true
  }, {
    name: 'roomId',
    type: 'string',
    required: true
  }, {
    name: 'isTyping',
    type: 'boolean',
    required: true
  }, {
    name: 'timestamp',
    type: 'int',
    required: true
  }]
})

Hyperschema.toDisk(roombase)

const dbTemplate = HyperdbBuilder.from('./spec/schema', './spec/db')
const collections = dbTemplate.namespace('roombase')

// Register collections for database
collections.collections.register({
  name: 'writer',
  schema: '@roombase/writer',
  key: ['key']
})

collections.collections.register({
  name: 'invite',
  schema: '@roombase/invite',
  key: ['id']
})

collections.collections.register({
  name: 'rooms',
  schema: '@roombase/rooms',
  key: ['id']
})

collections.collections.register({
  name: 'messages',
  schema: '@roombase/messages',
  key: ['id']
})

collections.collections.register({
  name: 'typing',
  schema: '@roombase/typing',
  key: ['userId', 'roomId']
})

HyperdbBuilder.toDisk(dbTemplate)

// Setup command dispatching
const hyperdispatch = Hyperdispatch.from('./spec/schema', './spec/hyperdispatch')
const namespace = hyperdispatch.namespace('roombase')

// Register command handlers
namespace.register({
  name: 'remove-writer',
  requestType: '@roombase/writer'
})

namespace.register({
  name: 'add-writer',
  requestType: '@roombase/writer'
})

namespace.register({
  name: 'add-invite',
  requestType: '@roombase/invite'
})

namespace.register({
  name: 'send-message',
  requestType: '@roombase/messages'
})

namespace.register({
  name: 'delete-message',
  requestType: '@roombase/messages'
})

namespace.register({
  name: 'typing-status',
  requestType: '@roombase/typing'
})

Hyperdispatch.toDisk(hyperdispatch)
