// This file is autogenerated by the hyperschema compiler
// Schema Version: 1
/* eslint-disable camelcase */
/* eslint-disable quotes */

const VERSION = 1
import { c } from 'hyperschema/runtime'

// eslint-disable-next-line no-unused-vars
let version = VERSION

// @roombase/writer
const encoding0 = {
  preencode(state, m) {
    c.buffer.preencode(state, m.key)
  },
  encode(state, m) {
    c.buffer.encode(state, m.key)
  },
  decode(state) {
    const r0 = c.buffer.decode(state)

    return {
      key: r0
    }
  }
}

// @roombase/invite
const encoding1 = {
  preencode(state, m) {
    c.buffer.preencode(state, m.id)
    c.buffer.preencode(state, m.invite)
    c.buffer.preencode(state, m.publicKey)
    c.int.preencode(state, m.expires)
  },
  encode(state, m) {
    c.buffer.encode(state, m.id)
    c.buffer.encode(state, m.invite)
    c.buffer.encode(state, m.publicKey)
    c.int.encode(state, m.expires)
  },
  decode(state) {
    const r0 = c.buffer.decode(state)
    const r1 = c.buffer.decode(state)
    const r2 = c.buffer.decode(state)
    const r3 = c.int.decode(state)

    return {
      id: r0,
      invite: r1,
      publicKey: r2,
      expires: r3
    }
  }
}

// @roombase/rooms
const encoding2 = {
  preencode(state, m) {
    c.string.preencode(state, m.id)
    c.string.preencode(state, m.name)
    c.int.preencode(state, m.createdAt)
  },
  encode(state, m) {
    c.string.encode(state, m.id)
    c.string.encode(state, m.name)
    c.int.encode(state, m.createdAt)
  },
  decode(state) {
    const r0 = c.string.decode(state)
    const r1 = c.string.decode(state)
    const r2 = c.int.decode(state)

    return {
      id: r0,
      name: r1,
      createdAt: r2
    }
  }
}

// @roombase/messages
const encoding3 = {
  preencode(state, m) {
    c.string.preencode(state, m.id)
    c.string.preencode(state, m.content)
    c.string.preencode(state, m.sender)
    c.int.preencode(state, m.timestamp)
    state.end++ // max flag is 2 so always one byte
  },
  encode(state, m) {
    const flags =
      (m.system ? 1 : 0) |
      (m.received ? 2 : 0)

    c.string.encode(state, m.id)
    c.string.encode(state, m.content)
    c.string.encode(state, m.sender)
    c.int.encode(state, m.timestamp)
    c.uint.encode(state, flags)
  },
  decode(state) {
    const r0 = c.string.decode(state)
    const r1 = c.string.decode(state)
    const r2 = c.string.decode(state)
    const r3 = c.int.decode(state)
    const flags = c.uint.decode(state)

    return {
      id: r0,
      content: r1,
      sender: r2,
      timestamp: r3,
      system: (flags & 1) !== 0,
      received: (flags & 2) !== 0
    }
  }
}

// @roombase/typing
const encoding4 = {
  preencode(state, m) {
    c.string.preencode(state, m.userId)
    c.string.preencode(state, m.roomId)
    state.end++ // max flag is 1 so always one byte
    c.int.preencode(state, m.timestamp)
  },
  encode(state, m) {
    const flags = m.isTyping ? 1 : 0

    c.string.encode(state, m.userId)
    c.string.encode(state, m.roomId)
    c.uint.encode(state, flags)
    c.int.encode(state, m.timestamp)
  },
  decode(state) {
    const r0 = c.string.decode(state)
    const r1 = c.string.decode(state)
    const flags = c.uint.decode(state)

    return {
      userId: r0,
      roomId: r1,
      isTyping: (flags & 1) !== 0,
      timestamp: c.int.decode(state)
    }
  }
}

// @roombase/writer/hyperdb#0
const encoding5 = {
  preencode(state, m) {

  },
  encode(state, m) {

  },
  decode(state) {
    return {
      key: null
    }
  }
}

// @roombase/invite/hyperdb#1
const encoding6 = {
  preencode(state, m) {
    c.buffer.preencode(state, m.invite)
    c.buffer.preencode(state, m.publicKey)
    c.int.preencode(state, m.expires)
  },
  encode(state, m) {
    c.buffer.encode(state, m.invite)
    c.buffer.encode(state, m.publicKey)
    c.int.encode(state, m.expires)
  },
  decode(state) {
    const r1 = c.buffer.decode(state)
    const r2 = c.buffer.decode(state)
    const r3 = c.int.decode(state)

    return {
      id: null,
      invite: r1,
      publicKey: r2,
      expires: r3
    }
  }
}

// @roombase/rooms/hyperdb#2
const encoding7 = {
  preencode(state, m) {
    c.string.preencode(state, m.name)
    c.int.preencode(state, m.createdAt)
  },
  encode(state, m) {
    c.string.encode(state, m.name)
    c.int.encode(state, m.createdAt)
  },
  decode(state) {
    const r1 = c.string.decode(state)
    const r2 = c.int.decode(state)

    return {
      id: null,
      name: r1,
      createdAt: r2
    }
  }
}

// @roombase/messages/hyperdb#3
const encoding8 = {
  preencode(state, m) {
    c.string.preencode(state, m.content)
    c.string.preencode(state, m.sender)
    c.int.preencode(state, m.timestamp)
    state.end++ // max flag is 2 so always one byte
  },
  encode(state, m) {
    const flags =
      (m.system ? 1 : 0) |
      (m.received ? 2 : 0)

    c.string.encode(state, m.content)
    c.string.encode(state, m.sender)
    c.int.encode(state, m.timestamp)
    c.uint.encode(state, flags)
  },
  decode(state) {
    const r1 = c.string.decode(state)
    const r2 = c.string.decode(state)
    const r3 = c.int.decode(state)
    const flags = c.uint.decode(state)

    return {
      id: null,
      content: r1,
      sender: r2,
      timestamp: r3,
      system: (flags & 1) !== 0,
      received: (flags & 2) !== 0
    }
  }
}

// @roombase/typing/hyperdb#4
const encoding9 = {
  preencode(state, m) {
    state.end++ // max flag is 1 so always one byte
    c.int.preencode(state, m.timestamp)
  },
  encode(state, m) {
    const flags = m.isTyping ? 1 : 0

    c.uint.encode(state, flags)
    c.int.encode(state, m.timestamp)
  },
  decode(state) {
    const flags = c.uint.decode(state)

    return {
      userId: null,
      roomId: null,
      isTyping: (flags & 1) !== 0,
      timestamp: c.int.decode(state)
    }
  }
}

function setVersion(v) {
  version = v
}

function encode(name, value, v = VERSION) {
  version = v
  return c.encode(getEncoding(name), value)
}

function decode(name, buffer, v = VERSION) {
  version = v
  return c.decode(getEncoding(name), buffer)
}

function getEnum(name) {
  switch (name) {
    default: throw new Error('Enum not found ' + name)
  }
}

function getEncoding(name) {
  switch (name) {
    case '@roombase/writer': return encoding0
    case '@roombase/invite': return encoding1
    case '@roombase/rooms': return encoding2
    case '@roombase/messages': return encoding3
    case '@roombase/typing': return encoding4
    case '@roombase/writer/hyperdb#0': return encoding5
    case '@roombase/invite/hyperdb#1': return encoding6
    case '@roombase/rooms/hyperdb#2': return encoding7
    case '@roombase/messages/hyperdb#3': return encoding8
    case '@roombase/typing/hyperdb#4': return encoding9
    default: throw new Error('Encoder not found ' + name)
  }
}

function getStruct(name, v = VERSION) {
  const enc = getEncoding(name)
  return {
    preencode(state, m) {
      version = v
      enc.preencode(state, m)
    },
    encode(state, m) {
      version = v
      enc.encode(state, m)
    },
    decode(state) {
      version = v
      return enc.decode(state)
    }
  }
}

const resolveStruct = getStruct // compat

export { resolveStruct, getStruct, getEnum, getEncoding, encode, decode, setVersion, version }
