import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Text, useInput } from 'ink';
import chalk from 'chalk';

/**
 * Enhanced TextInput component with better navigation and selection support
 */
function TextInput({
  value: originalValue = '',
  placeholder = '',
  focus = true,
  mask,
  highlightPastedText = false,
  showCursor = true,
  onChange,
  onSubmit,
  wrap = "none",
  maxLength
}) {
  // State for cursor position and selection
  const [state, setState] = useState({
    cursorOffset: originalValue.length || 0,
    cursorWidth: 0,
    selectionStart: -1,
    selectionEnd: -1,
    isSelecting: false
  });

  // Track the last paste timestamp for highlighting
  const lastPasteRef = useRef(0);

  // Debounce timeout
  const debounceRef = useRef(null);

  const {
    cursorOffset,
    cursorWidth,
    selectionStart,
    selectionEnd,
    isSelecting
  } = state;

  // Update cursor position when value or focus changes
  useEffect(() => {
    setState(previousState => {
      if (!focus || !showCursor) {
        return previousState;
      }

      const newValue = originalValue || '';

      // Keep cursor within bounds of the new value
      if (previousState.cursorOffset > newValue.length) {
        return {
          ...previousState,
          cursorOffset: newValue.length,
          cursorWidth: 0
        };
      }

      return previousState;
    });
  }, [originalValue, focus, showCursor]);

  // Determine cursor width for highlighting pasted text
  const cursorActualWidth = highlightPastedText ? cursorWidth : 0;

  // Apply mask if needed
  const value = mask ? mask.repeat(originalValue.length) : originalValue;

  // Prepare the displayed value with cursor and selection
  const getRenderedValue = useCallback(() => {
    if (!value.length && !showCursor) {
      return placeholder ? chalk.grey(placeholder) : '';
    }

    // Handle empty value with cursor
    if (!value.length && showCursor && focus) {
      return chalk.inverse(' ');
    }

    let result = '';

    // Render with selection or cursor
    if (isSelecting && selectionStart >= 0 && selectionEnd >= 0 && selectionStart !== selectionEnd) {
      // With selection
      for (let i = 0; i < value.length; i++) {
        const isSelected = i >= selectionStart && i < selectionEnd;
        result += isSelected ? chalk.inverse(value[i]) : value[i];
      }

      // Add cursor at the end if needed
      if (showCursor && focus && cursorOffset === value.length) {
        result += chalk.inverse(' ');
      }
    } else {
      // With cursor only
      for (let i = 0; i < value.length; i++) {
        const isAtCursor = i === cursorOffset;
        result += isAtCursor && showCursor && focus ?
          chalk.inverse(value[i]) : value[i];
      }

      // Add cursor at the end if needed
      if (showCursor && focus && cursorOffset === value.length) {
        result += chalk.inverse(' ');
      }
    }

    return result;
  }, [
    value,
    showCursor,
    focus,
    placeholder,
    isSelecting,
    selectionStart,
    selectionEnd,
    cursorOffset
  ]);

  // Get placeholder display
  const getRenderedPlaceholder = useCallback(() => {
    if (!placeholder) return undefined;

    if (showCursor && focus) {
      return chalk.inverse(placeholder[0]) + chalk.grey(placeholder.slice(1));
    }

    return chalk.grey(placeholder);
  }, [placeholder, showCursor, focus]);

  // Handle key input with improved navigation
  useInput((input, key) => {
    if (!focus) return;

    // Standard navigation keys that we don't handle
    if (
      (key.upArrow || key.downArrow) ||
      (key.ctrl && input === 'c') ||
      (key.shift && key.tab) ||
      (key.tab && !isSelecting) // We handle tab with selection
    ) {
      return;
    }

    // Process enter key
    if (key.return) {
      if (onSubmit) {
        onSubmit(originalValue);
      }
      return;
    }

    // Handle standard text editing
    let nextCursorOffset = cursorOffset;
    let nextValue = originalValue;
    let nextCursorWidth = 0;
    let nextSelectionStart = -1;
    let nextSelectionEnd = -1;
    let nextIsSelecting = isSelecting;

    // Process selection with shift key
    if (key.shift && (key.leftArrow || key.rightArrow) && showCursor) {
      if (!nextIsSelecting) {
        // Start new selection
        nextIsSelecting = true;
        nextSelectionStart = cursorOffset;
        nextSelectionEnd = cursorOffset;
      }

      // Extend selection
      if (key.leftArrow && cursorOffset > 0) {
        nextCursorOffset--;
        nextSelectionEnd = nextCursorOffset;
      } else if (key.rightArrow && cursorOffset < originalValue.length) {
        nextCursorOffset++;
        nextSelectionEnd = nextCursorOffset;
      }
    }
    // Handle home key - move to start
    else if (key.ctrl && input === 'a') {
      nextCursorOffset = 0;
      nextIsSelecting = false;
    }
    // Handle end key - move to end
    else if (key.ctrl && input === 'e') {
      nextCursorOffset = originalValue.length;
      nextIsSelecting = false;
    }
    // Select all
    else if (key.ctrl && input === 'A') {
      nextSelectionStart = 0;
      nextSelectionEnd = originalValue.length;
      nextCursorOffset = originalValue.length;
      nextIsSelecting = true;
    }
    // Left/right arrow navigation (without shift)
    else if ((key.leftArrow || key.rightArrow) && showCursor) {
      if (key.leftArrow) {
        nextCursorOffset = Math.max(0, cursorOffset - 1);
      } else if (key.rightArrow) {
        nextCursorOffset = Math.min(originalValue.length, cursorOffset + 1);
      }

      // Clear any selection
      nextIsSelecting = false;
    }
    // Handle backspace and delete
    else if (key.backspace || key.delete) {
      if (isSelecting && selectionStart >= 0 && selectionEnd >= 0) {
        // Delete selection
        nextValue =
          originalValue.slice(0, selectionStart) +
          originalValue.slice(selectionEnd);
        nextCursorOffset = selectionStart;
        nextIsSelecting = false;
      } else if ((key.backspace || key.delete) && cursorOffset > 0) {
        // Backspace at cursor
        nextValue =
          originalValue.slice(0, cursorOffset - 1) +
          originalValue.slice(cursorOffset);
        nextCursorOffset--;
        nextIsSelecting = false;
      }
    }
    // Handle tab to indent
    else if (key.tab && isSelecting) {
      // Tab with selection - indent block
      const lines = originalValue.split('\n');
      let charCount = 0;
      let startLine = -1;
      let endLine = -1;

      // Find start and end lines of selection
      for (let i = 0; i < lines.length; i++) {
        const lineLength = lines[i].length + 1; // +1 for newline

        if (startLine === -1 && charCount + lineLength > selectionStart) {
          startLine = i;
        }

        if (endLine === -1 && charCount + lineLength >= selectionEnd) {
          endLine = i;
          break;
        }

        charCount += lineLength;
      }

      if (startLine !== -1) {
        // If shift+tab, remove indentation
        if (key.shift) {
          // Remove indentation from selected lines
          for (let i = startLine; i <= endLine; i++) {
            if (lines[i].startsWith('  ')) {
              lines[i] = lines[i].substring(2);
            } else if (lines[i].startsWith(' ')) {
              lines[i] = lines[i].substring(1);
            } else if (lines[i].startsWith('\t')) {
              lines[i] = lines[i].substring(1);
            }
          }
        } else {
          // Add indentation to selected lines
          for (let i = startLine; i <= endLine; i++) {
            lines[i] = '  ' + lines[i];
          }
        }

        nextValue = lines.join('\n');
        // Maintain selection on the indented block
        nextIsSelecting = true;
      }
    }
    // Regular text input
    else if (input.length > 0) {
      // Check if we're pasting (input length > 1 usually means paste)
      const isPasting = input.length > 1 || Date.now() - lastPasteRef.current < 10;

      if (isPasting) {
        lastPasteRef.current = Date.now();
        nextCursorWidth = input.length;
      }

      if (isSelecting && selectionStart >= 0 && selectionEnd >= 0) {
        // Replace selection with input
        nextValue =
          originalValue.slice(0, selectionStart) +
          input +
          originalValue.slice(selectionEnd);
        nextCursorOffset = selectionStart + input.length;
        nextIsSelecting = false;
      } else {
        // Insert at cursor
        nextValue =
          originalValue.slice(0, cursorOffset) +
          input +
          originalValue.slice(cursorOffset);
        nextCursorOffset += input.length;
        nextIsSelecting = false;
      }
    }

    // Enforce maxLength if specified
    if (maxLength && nextValue.length > maxLength) {
      nextValue = nextValue.slice(0, maxLength);
      nextCursorOffset = Math.min(nextCursorOffset, maxLength);
    }

    // Ensure cursor stays within bounds
    nextCursorOffset = Math.max(0, Math.min(nextValue.length, nextCursorOffset));

    // Update state
    setState({
      cursorOffset: nextCursorOffset,
      cursorWidth: nextCursorWidth,
      selectionStart: nextSelectionStart,
      selectionEnd: nextSelectionEnd,
      isSelecting: nextIsSelecting
    });

    // Notify changes using debounce for rapid typing
    if (nextValue !== originalValue && onChange) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // For normal edits, update immediately
      if (input.length <= 1) {
        onChange(nextValue);
      } else {
        // For pastes or large inputs, debounce
        debounceRef.current = setTimeout(() => {
          onChange(nextValue);
          debounceRef.current = null;
        }, 10);
      }
    }
  }, { isActive: focus });

  // Calculate rendered values
  const renderedValue = getRenderedValue();
  const renderedPlaceholder = getRenderedPlaceholder();

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <Text wrap={wrap}>
      {value.length > 0 ? renderedValue : renderedPlaceholder}
    </Text>
  );
}

export default React.memo(TextInput);
