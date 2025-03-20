// components/Chat/InputBar.js - Enhanced for multiline input
import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { useChat } from '../../contexts/ChatContext.js';

const InputBar = ({ width = 100, isFocused = false }) => {
  const {
    inputMode,
    focusedPanel,
    inputValue,
    setInputValue,
    handleInputSubmit
  } = useChat();

  // Split multiline input for display
  const displayLines = inputValue.split('\n');
  const displayValue = displayLines.length > 1
    ? `${displayLines[0]}... (${displayLines.length} lines)`
    : inputValue;

  const handleChange = (value) => {
    // Allow pasted text with newlines
    setInputValue(value);
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
      <Box width={3} alignItems="center" justifyContent="flex-start">
        <Text color={isFocused ? 'green' : 'gray'} bold={isFocused}>
          {inputMode ? '_' : '>'}
        </Text>
      </Box>
      <Box width="100%" flexGrow={1} alignItems="center" justifyContent="flex-start">
        {inputMode ? (
          <TextInput
            value={displayValue}
            onChange={handleChange}
            onSubmit={handleInputSubmit}
            focus={inputMode} // Ensure focus when in input mode
          />
        ) : (
          <Text color="gray">Press Enter to type (paste supported)</Text>
        )}
      </Box>
      <Box width={30} alignItems="center" justifyContent="center">
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
