// This file is autogenerated by the hyperdispatch compiler
/* eslint-disable camelcase */

import { version, getEncoding, setVersion } from './messages.js'

import pkg from 'hyperdispatch/runtime.js';
const { c, b4a, assert } = pkg;

const defaultVersion = version

class Router {
  constructor() {
    this._handler0 = null
    this._handler1 = null
    this._handler2 = null
    this._handler3 = null
    this._handler4 = null
    this._handler5 = null

    this._missing = 6
  }

  add(name, handler) {
    switch (name) {
      case '@roombase/remove-writer':
        this._handler0 = handler
        break
      case '@roombase/add-writer':
        this._handler1 = handler
        break
      case '@roombase/add-invite':
        this._handler2 = handler
        break
      case '@roombase/send-message':
        this._handler3 = handler
        break
      case '@roombase/delete-message':
        this._handler4 = handler
        break
      case '@roombase/set-metadata':
        this._handler5 = handler
        break
      default:
        throw new Error('Cannot register a handler for a nonexistent route: ' + name)
    }
    this._missing--
  }

  _checkAll() {
    assert(this._handler0 !== null, 'Missing handler for "@roombase/remove-writer"')
    assert(this._handler1 !== null, 'Missing handler for "@roombase/add-writer"')
    assert(this._handler2 !== null, 'Missing handler for "@roombase/add-invite"')
    assert(this._handler3 !== null, 'Missing handler for "@roombase/send-message"')
    assert(this._handler4 !== null, 'Missing handler for "@roombase/delete-message"')
    assert(this._handler5 !== null, 'Missing handler for "@roombase/set-metadata"')
  }

  async dispatch(encoded, context) {
    if (this._missing > 0) {
      this._checkAll()
    }

    const state = { buffer: encoded, start: 0, end: encoded.byteLength }
    const id = c.uint.decode(state)

    setVersion(defaultVersion)

    switch (id) {
      case 0:
        return this._handler0(route0.enc.decode(state), context)
      case 1:
        return this._handler1(route1.enc.decode(state), context)
      case 2:
        return this._handler2(route2.enc.decode(state), context)
      case 3:
        return this._handler3(route3.enc.decode(state), context)
      case 4:
        return this._handler4(route4.enc.decode(state), context)
      case 5:
        return this._handler5(route5.enc.decode(state), context)
      default:
        throw new Error('Handler not found for ID:' + id)
    }
  }
}

function dispatch(name, message, { version = defaultVersion } = {}) {
  const state = { buffer: null, start: 0, end: 0 }

  const o = getEncoderAndId(name)
  setVersion(version)

  c.uint.preencode(state, o.id)
  o.enc.preencode(state, message)

  state.buffer = b4a.allocUnsafe(state.end)
  c.uint.encode(state, o.id)
  o.enc.encode(state, message)

  return state.buffer
}

const route0 = {
  id: 0,
  enc: getEncoding('@roombase/writer')
}

const route1 = {
  id: 1,
  enc: getEncoding('@roombase/writer')
}

const route2 = {
  id: 2,
  enc: getEncoding('@roombase/invite')
}

const route3 = {
  id: 3,
  enc: getEncoding('@roombase/messages')
}

const route4 = {
  id: 4,
  enc: getEncoding('@roombase/messages')
}

const route5 = {
  id: 5,
  enc: getEncoding('@roombase/metadata')
}

function getEncoderAndId(name) {
  switch (name) {
    case '@roombase/remove-writer':
      return route0
    case '@roombase/add-writer':
      return route1
    case '@roombase/add-invite':
      return route2
    case '@roombase/send-message':
      return route3
    case '@roombase/delete-message':
      return route4
    case '@roombase/set-metadata':
      return route5
    default:
      throw new Error('Handler not found for name: ' + name)
  }
}

export {
  version,
  dispatch,
  Router
}
