// components/Chat/InputBar.js - Fixed to prevent double submissions
import React, { useState, useRef, useCallback } from 'react';
import { Box, Text } from 'ink';
import TextInput from '../TextInput.js';
import { useChat } from '../../contexts/ChatContext.js';
import { getBindingDescription, getBindingsForContext } from '../../utils/keymap.js';
import { sanitizeTextForTerminal } from '../FileExplorer/utils.js';
import useThemeUpdate from '../../hooks/useThemeUpdate.js';

const InputBar = ({ width = 100, isFocused = false }) => {

  const [localInputValue, setLocalInputValue] = useState('');
  const {
    inputMode,
    focusedPanel,
    setInputValue,
    handleInputSubmit
  } = useChat();
  const {
    primaryColor,
    textColor,
    mutedTextColor,
    borderColor,
    activeBorderColor,
  } = useThemeUpdate().colors
  // Track submission state to prevent double submissions
  const isSubmittingRef = useRef(false);

  // Get key binding descriptions
  const contextBindings = getBindingsForContext('chat');
  const sendKey = getBindingDescription(contextBindings.focusInput);

  // Split multiline input for display
  const displayLines = localInputValue.split('\n');
  const displayValue = displayLines.length > 1
    ? `${displayLines[0]}... (${displayLines.length} lines)`
    : localInputValue;

  const handleChange = (value) => {
    // Allow pasted text with newlines
    setLocalInputValue(sanitizeTextForTerminal(value));
  };

  // Wrap handleInputSubmit to prevent double submissions
  const handleSubmit = useCallback((value) => {
    if (isSubmittingRef.current) {
      console.log('Preventing duplicate submission');
      return;
    }
    isSubmittingRef.current = true;
    setInputValue(value); // Update context once
    handleInputSubmit(value);
    // Reset the flag after a short delay
    setLocalInputValue('');
    setTimeout(() => {
      isSubmittingRef.current = false;
    }, 50);
  }, [localInputValue]);

  return (
    <Box
      width={width}
      height={3}
      borderStyle="single"
      borderColor={isFocused ? activeBorderColor : borderColor}
      flexDirection="row"
      alignItems="center"
      justifyContent="flex-start"
    >
      <Box width={3} alignItems="center" justifyContent="flex-start">
        <Text color={isFocused ? primaryColor : mutedTextColor} bold={isFocused}>
          {inputMode ? '_' : '>'}
        </Text>
      </Box>
      <Box width="100%" flexGrow={1} alignItems="center" justifyContent="flex-start">
        {inputMode ? (
          <TextInput
            wrap={"truncate-start"}
            value={localInputValue}
            onChange={handleChange}
            onSubmit={handleSubmit}
            focus={inputMode} // Ensure focus when in input mode
          />
        ) : (
          <Text color={textColor}>Press {sendKey} to type (paste supported)</Text>
        )}
      </Box>
      <Box width={30} alignItems="center" justifyContent="center">
        <Text color={mutedTextColor}>
          {inputMode
            ? `[${sendKey}] ${focusedPanel === 'rooms' ? 'Create room' : 'Send message'}`
            : `[${sendKey}] Focus`}
        </Text>
      </Box>
    </Box>
  );
};

export default React.memo(InputBar);
