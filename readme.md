# Hyperchatters CLI

A terminal-based peer-to-peer chat application with file sharing capabilities.

[![npm version](https://img.shields.io/npm/v/@hyperchatters/cli.svg)](https://www.npmjs.com/package/@hyperchatters/cli)

## Features

- **P2P Chat**: Direct messaging without central servers
- **Room-Based Communication**: Create or join rooms with invite codes
- **File Sharing**: Send and receive files through the Hypercore protocol
- **Terminal UI**: Fully navigable with keyboard shortcuts
- **Customizable**: Configurable themes and keymaps

## Installation

```bash
npm install -g @hyperchatters/cli
```

## Usage

```bash
# Start the application
hyperchatters
```

## Key Commands

### General Navigation

- `Tab`: Switch between panels (rooms, messages, users)
- `Enter`: Focus input field / submit message
- `Esc`: Back / Exit

### Chat Commands

- `/join <code>`: Join a room with an invite code
- `/invite`: Generate an invite code for the current room
- `/leave`: Leave the current room
- `/profile <name>`: Change your display name
- `/send` or `S`: Share a file
- `/files` or `F`: View shared files by peers in room

### File Management

- `D`: Download selected file

## Configuration

Configuration files are stored in `~/.config/.hyperchatters/`:

- `keymap.json`: Customize keyboard shortcuts
- `themes/`: Custom theme settings
- `identity.json`: Your user identity

## Technical Details

Hyperchatters uses:

- [Hypercore](https://github.com/hypercore-protocol/hypercore) for the P2P protocol
- [Hyperblobs](https://github.com/hypercore-protocol/hyperblobs) for file storage
- [Hyperswarm](https://github.com/hypercore-protocol/hyperswarm) for peer discovery
- [Ink](https://github.com/vadimdemedes/ink) for terminal UI

## License

MIT
