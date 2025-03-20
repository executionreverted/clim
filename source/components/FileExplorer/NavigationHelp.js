// components/FileExplorer/NavigationHelp.js
import React from 'react';
import { Box, Text } from 'ink';

const NavigationHelp = ({ width = 80, showPickOption = true, showMultiSelectOption = false }) => {
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
          <Text color="green">↑/↓</Text>: Navigate |
          <Text color="green"> PgUp/PgDn</Text>: Jump |
          <Text color="green"> ENTER</Text>: Open dir |
          <Text color="green"> h/Delete</Text>: Parent dir |
          <Text color="green"> b</Text>: Go back
        </Text>
      </Box>
      <Box width={width - 4}>
        <Text wrap="truncate">
          <Text color="green">Ctrl+↑/↓</Text>: Scroll preview |
          <Text color="green"> o</Text>: Open file in system |
          {showPickOption && <Text><Text color="green"> p</Text>: Pick file</Text>}
          {showMultiSelectOption && <Text> | <Text color="green">SPACE</Text>: Select file</Text>}
        </Text>
      </Box>
    </Box>
  );
};

export default NavigationHelp;
