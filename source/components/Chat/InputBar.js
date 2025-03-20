// components/Chat/InputBar.js
import React from 'react';
import { Box, Text } from 'ink';
import { useChat } from '../../contexts/ChatContext.js';

const InputBar = ({ width = 100, isFocused = false, value = '' }) => {
  const { inputMode, focusedPanel } = useChat();

  // Calculate the maximum visible input length
  const maxInputLength = width - 20;

  // Prepare the display value with potential truncation
  let displayValue = value;
  if (displayValue.length > maxInputLength) {
    displayValue = '...' + displayValue.slice(-maxInputLength + 3);
  }

  // Determine placeholder text based on focus and input mode
  let placeholder = 'Press Enter to focus';

  if (isFocused) {
    if (inputMode) {
      placeholder = displayValue || 'Type your message...';
    } else {
      placeholder = 'Press Enter to type';
    }
  }

  // Determine placeholder color
  let placeholderColor = 'gray';
  if (isFocused) {
    placeholderColor = inputMode ? 'white' : 'yellow';
  }

  // Determine action text based on focused panel
  let actionText = 'Send message';
  if (focusedPanel === 'rooms' && inputMode) {
    actionText = 'Create room';
  }

  return (
    <Box
      width={width}
      borderStyle="single"
      borderColor={isFocused ? "green" : "gray"}
      padding={1}
    >
      <Box>
        <Text color={isFocused ? 'green' : 'gray'} bold={isFocused}>
          {inputMode ? '✍' : '>'}
        </Text>
      </Box>

      <Box marginLeft={1} flexGrow={1}>
        <Text color={placeholderColor}>
          {placeholder}
        </Text>
      </Box>

      <Box marginLeft={1}>
        <Text color="gray">
          {isFocused && inputMode ? `[Enter] ${actionText}` : ''}
        </Text>
      </Box>
    </Box>
  );
};

export default InputBar;
