// components/Chat/InputBar.js
import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { useChat } from '../../contexts/ChatContext.js';
import { getBindingDescription, getBindingsForContext } from '../../utils/keymap.js';

const InputBar = ({ width = 100, isFocused = false }) => {
  const {
    inputMode,
    focusedPanel,
    inputValue,
    setInputValue,
    handleInputSubmit
  } = useChat();

  // Get key binding descriptions
  const contextBindings = getBindingsForContext('chat');
  const sendKey = getBindingDescription(contextBindings.focusInput);

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
          <Text color="gray">Press {sendKey} to type (paste supported)</Text>
        )}
      </Box>
      <Box width={30} alignItems="center" justifyContent="center">
        <Text color="gray">
          {inputMode
            ? `[${sendKey}] ${focusedPanel === 'rooms' ? 'Create room' : 'Send message'}`
            : `[${sendKey}] Focus`}
        </Text>
      </Box>
    </Box>
  );
};

export default InputBar;
