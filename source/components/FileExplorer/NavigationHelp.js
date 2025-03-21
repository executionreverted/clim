// components/FileExplorer/NavigationHelp.js
import React from 'react';
import { Box, Text } from 'ink';
import { getBindingsForContext, getBindingDescription } from '../../utils/keymap.js';

const NavigationHelp = ({ width = 80, showPickOption = true, showMultiSelectOption = false }) => {
  // Get key bindings for the file explorer
  const contextBindings = getBindingsForContext('fileExplorer');

  // Get human-readable key descriptions
  const navUpKey = getBindingDescription(contextBindings.navigateUp);
  const navDownKey = getBindingDescription(contextBindings.navigateDown);
  const pageUpKey = getBindingDescription(contextBindings.pageUp);
  const pageDownKey = getBindingDescription(contextBindings.pageDown);
  const openDirKey = getBindingDescription(contextBindings.openDir);
  const parentDirKey = getBindingDescription(contextBindings.parentDir);
  const goBackKey = getBindingDescription(contextBindings.goBack);
  const previewScrollUpKey = getBindingDescription(contextBindings.previewScrollUp);
  const previewScrollDownKey = getBindingDescription(contextBindings.previewScrollDown);
  const openFileKey = getBindingDescription(contextBindings.openFile);
  const pickFileKey = contextBindings.pickFile ? getBindingDescription(contextBindings.pickFile) : 'p';
  const toggleSelectionKey = contextBindings.toggleSelection ? getBindingDescription(contextBindings.toggleSelection) : 'Space';

  return (
    <Box
      width={width}
      borderStyle="single"
      borderColor="gray"
      padding={1}
      flexDirection="column"
    >
      <Box width={width - 4}>
        <Text wrap="truncate">
          <Text color="green">{navUpKey}/{navDownKey}</Text>: Navigate |
          <Text color="green"> {pageUpKey}/{pageDownKey}</Text>: Jump |
          <Text color="green"> {openDirKey}</Text>: Open dir |
          <Text color="green"> {parentDirKey}</Text>: Parent dir |
          <Text color="green"> {goBackKey}</Text>: Go back
        </Text>
      </Box>
      <Box width={width - 4}>
        <Text wrap="truncate">
          <Text color="green">{previewScrollUpKey}/{previewScrollDownKey}</Text>: Scroll preview |
          <Text color="green"> {openFileKey}</Text>: Open file in system
          {showPickOption && <Text> | <Text color="green">{pickFileKey}</Text>: Pick file</Text>}
          {showMultiSelectOption && <Text> | <Text color="green">{toggleSelectionKey}</Text>: Select file</Text>}
        </Text>
      </Box>
    </Box>
  );
};

export default NavigationHelp;
