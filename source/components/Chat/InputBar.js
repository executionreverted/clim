// components/Chat/InputBar.js - Enhanced for multiline input
import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { useChat } from '../../contexts/ChatContext.js';
import { sanitizeTextForTerminal } from "../FileExplorer/utils.js"
import stringWidth from 'string-width';
const InputBar = ({ width = 100, isFocused = false }) => {
  const {
    inputMode,
    focusedPanel,
    inputValue,
    setInputValue,
    handleInputSubmit
  } = useChat();

  // Calculate available width for input
  const statusWidth = 30; // Width of the status area
  const promptWidth = 3;  // Width of the prompt area
  const availableWidth = width - statusWidth - promptWidth - 4; // Subtract borders and padding

  // Split multiline input for display
  const displayLines = inputValue.split('\n');

  // Create a display value that fits within the available width while preserving original inputValue
  let displayValue = inputValue;

  // For display purposes only - this won't change the actual inputValue state
  const firstLine = displayLines[0] || '';

  // If there are multiple lines or the first line is too long, show truncated display
  if (displayLines.length > 1) {
    displayValue = `${firstLine.slice(0, Math.max(0, availableWidth - 15))}... (${displayLines.length} lines)`;
  } else if (stringWidth(firstLine) > availableWidth) {
    displayValue = firstLine.slice(0, Math.max(0, availableWidth - 10)) + '...';
  }

  const handleChange = (value) => {
    // Allow pasted text with newlines
    setInputValue(sanitizeTextForTerminal(value));
  };

  return (
    <Box
      width={width}
      height={3}
      borderStyle="single"
      borderColor={isFocused ? "green" : "gray"}
      flexDirection="row"
      alignItems="center"
      justifyContent="flex-start"
    >
      <Box width={promptWidth} alignItems="center" justifyContent="flex-start">
        <Text color={isFocused ? 'green' : 'gray'} bold={isFocused}>
          {inputMode ? '_' : '>'}
        </Text>
      </Box>

      <Box width={availableWidth} flexShrink={1} alignItems="center" justifyContent="flex-start">
        {inputMode ? (
          <Box width={availableWidth}>
            <Text wrap="truncate-start">
              <TextInput
                value={inputValue}
                onChange={handleChange}
                onSubmit={handleInputSubmit}
                focus={inputMode}
              />
            </Text>
          </Box>
        ) : (
          <Text color="gray">Press Enter to type (paste supported)</Text>
        )}
      </Box>

      <Box width={statusWidth} alignItems="center" justifyContent="center">
        <Text color="gray">
          {inputMode
            ? `[Enter] ${focusedPanel === 'rooms' ? 'Create room' : 'Send message'}`
            : '[Enter] Focus'}
        </Text>
      </Box>
    </Box>
  );
};

export default InputBar;
