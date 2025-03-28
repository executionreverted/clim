// Updated NavigationHelp.js for Hyperblobs (removed directory-related options)
import React from 'react';
import { Box, Text } from 'ink';
import useThemeUpdate from '../../hooks/useThemeUpdate.js';
import { getBindingDescription, getBindingsForContext } from '../../utils/keymap.js';

const NavigationHelp = ({ width = 80 }) => {
  const currentTheme = useThemeUpdate();
  const {
    primaryColor,
    secondaryColor,
    textColor,
    mutedTextColor,
    borderColor,
    successColor
  } = currentTheme.colors;

  // Get key bindings for file explorer
  const contextBindings = getBindingsForContext('fileExplorer');

  // Get human-readable key descriptions
  const navUpKey = getBindingDescription(contextBindings.navigateUp);
  const navDownKey = getBindingDescription(contextBindings.navigateDown);
  const pageUpKey = getBindingDescription(contextBindings.pageUp);
  const pageDownKey = getBindingDescription(contextBindings.pageDown);
  const previewScrollUpKey = getBindingDescription(contextBindings.previewScrollUp);
  const previewScrollDownKey = getBindingDescription(contextBindings.previewScrollDown);
  const downloadKey = getBindingDescription(contextBindings.download);
  const deleteKey = getBindingDescription(contextBindings.delete);
  const refreshKey = getBindingDescription(contextBindings.refresh);
  const backKey = getBindingDescription(contextBindings.back);
  const uploadFileKey = getBindingDescription(contextBindings.uploadFile);

  return (
    <Box
      width={width}
      borderStyle="single"
      borderColor={borderColor}
      padding={1}
      flexDirection="column"
    >
      <Box width={width - 4}>
        <Text wrap="truncate">
          <Text color={successColor}>{navUpKey}/{navDownKey}</Text>: Navigate |
          <Text color={successColor}> {pageUpKey}/{pageDownKey}</Text>: Page Up/Down |
          <Text color={successColor}> {backKey}</Text>: Return to chat |
          <Text color={successColor}> {uploadFileKey}</Text>: Upload File |
          <Text color={successColor}> {refreshKey}</Text>: Refresh
        </Text>
      </Box>

      <Box width={width - 4}>
        <Text wrap="truncate">
          <Text color={successColor}>{previewScrollUpKey}/{previewScrollDownKey}</Text>: Scroll preview |
          <Text color={successColor}> {downloadKey}</Text>: Download file |
          <Text color={successColor}> {deleteKey}</Text>: Delete file
        </Text>
      </Box>
    </Box>
  );
};

export default NavigationHelp;
