// components/FileExplorer/NavigationHelp.js
import React from 'react';
import { Box, Text } from 'ink';

const NavigationHelp = ({ width }) => {
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
          <Text color="green"> BACKSPACE/h</Text>: Parent dir |
          <Text color="green"> b</Text>: Back
        </Text>
      </Box>
      <Box width={width - 4}>
        <Text wrap="truncate">
          <Text color="green">Ctrl+↑/↓</Text>: Scroll preview content for text files
        </Text>
      </Box>
    </Box>
  );
};

export default NavigationHelp;
