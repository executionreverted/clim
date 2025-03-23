// source/utils/keymap-cli.js
import fs from 'fs';
import path from 'path';
import os from 'os';
import meow from 'meow';
import {
  generateKeymapConfig,
  writeDefaultConfig,
  validateKeymap,
  showKeyBindings
} from './keymap-util.js';
import { loadKeymap, DEFAULT_KEYMAP } from './keymap.js';

const CONFIG_PATH = path.join(os.homedir(), '.hyperchatters.conf');

// CLI definition
const cli = meow(`
  Usage
    $ hyper-keymap <command>

  Commands
    generate     Generate a default keymap configuration
    validate     Validate the current keymap configuration
    show [context]   Show key bindings for a specific context
    reset        Reset to default keymap

  Options
    --output, -o  Output file path (defaults to ~/.hyperchatters.conf)
    --help        Show this help message

  Examples
    $ hyper-keymap generate -o ./custom-keymap.json
    $ hyper-keymap validate
    $ hyper-keymap show chat
    $ hyper-keymap reset
`, {
  importMeta: import.meta,
  flags: {
    output: {
      type: 'string',
      alias: 'o',
      default: CONFIG_PATH
    }
  }
});

// Command handlers
const commands = {
  // Generate a default keymap configuration
  generate: () => {
    const outputPath = cli.flags.output;
    const config = generateKeymapConfig();

    if (config) {
      try {
        fs.writeFileSync(outputPath, config);
      } catch (error) {
        console.error(`Error writing to ${outputPath}: ${error.message}`);
        process.exit(1);
      }
    } else {
      console.error('Failed to generate keymap configuration');
      process.exit(1);
    }
  },

  // Validate the current keymap configuration
  validate: () => {
    try {
      // Try to load current keymap
      if (!fs.existsSync(CONFIG_PATH)) {
        console.error(`Configuration file not found at: ${CONFIG_PATH}`);
        process.exit(1);
      }

      const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
      let keymap;

      try {
        keymap = JSON.parse(configData);
      } catch (error) {
        console.error(`Invalid JSON in configuration file: ${error.message}`);
        process.exit(1);
      }

      const validation = validateKeymap(keymap);

      if (validation.valid) {
      } else {
        console.error('Keymap configuration is invalid:');
        validation.errors.forEach(error => {
          console.error(`- ${error}`);
        });
        process.exit(1);
      }
    } catch (error) {
      console.error(`Error validating keymap: ${error.message}`);
      process.exit(1);
    }
  },

  // Show key bindings for a specific context
  show: (context) => {
    if (!context) {
      // Show all available contexts
      Object.keys(DEFAULT_KEYMAP).forEach(ctx => {
      });
      return;
    }

  },

  // Reset to default keymap
  reset: () => {
    if (fs.existsSync(CONFIG_PATH)) {
      try {
        fs.unlinkSync(CONFIG_PATH);
      } catch (error) {
        console.error(`Error removing keymap configuration: ${error.message}`);
        process.exit(1);
      }
    } else {
    }
  }
};

// Main execution
const [command, ...args] = cli.input;

if (!command) {
  cli.showHelp();
} else if (commands[command]) {
  commands[command](...args);
} else {
  console.error(`Unknown command: ${command}`);
  cli.showHelp();
  process.exit(1);
}
