// source/hooks/useKeymap.js
import { useRef } from 'react';
import { useInput } from 'ink';
import { loadKeymap, matchesKeyBinding, getBindingsForContext } from '../utils/keymap.js';

/**
 * Hook to handle keyboard input based on the keymap configuration
 *
 * @param {string} context - Current context (e.g., 'fileExplorer', 'chat')
 * @param {Object} handlers - Object mapping action names to handler functions
 * @param {Object} options - Additional options
 * @param {boolean} options.isActive - Whether keyboard handling is active
 * @param {Object} options.customKeymap - Optional custom keymap to use instead of loading from file
 * @returns {Object} - The loaded keymap for the current context
 */
export function useKeymap(context, handlers = {}, options = {}) {
  const { isActive = true, customKeymap = null } = options;

  // Load keymap on first render
  const keymapRef = useRef(customKeymap || loadKeymap());

  // Get bindings for the current context (including global)
  const contextBindings = getBindingsForContext(context, keymapRef.current);

  useInput((input, key) => {
    if (!isActive) return;

    // Check each binding to see if it matches
    if (input === " ") key.space = true;

    // Debug log to see what keys are being pressed (uncomment for debugging)

    for (const [action, binding] of Object.entries(contextBindings)) {
      if (matchesKeyBinding({ input, key, ...key }, binding)) {
        // If we have a handler for this action, call it
        if (handlers[action]) {
          // If the handler returns true, it means it handled the event
          // and we should not continue processing other handlers
          const handled = handlers[action]();
          if (handled === true) {
            return;
          }
        }
      }
    }
  });

  return {
    keymap: keymapRef.current,
    contextBindings
  };
}

export default useKeymap;
