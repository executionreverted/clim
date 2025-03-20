// components/Welcome.js
import React from 'react';
import { Box, Text, useInput } from 'ink';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';

const Welcome = ({ onStart, width = 100, height = 24 }) => {
  useInput((input, key) => {
    if (input === 'enter' || key.return) {
      onStart();
    }
  });

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      width={width}
      height={height}
      padding={0}
    >
      {/* Center the content vertically in the available space */}
      <Box flexGrow={1} />

      <Gradient name="rainbow">
        <BigText text="FileXplorer" align="center" font="block" />
      </Gradient>

      <Box marginY={1}>
        <Text>A simple terminal file explorer</Text>
      </Box>

      <Box marginY={2} padding={1} borderStyle="round" borderColor="green">
        <Text>Press <Text color="green" bold>ENTER</Text> to start exploring files</Text>
      </Box>

      <Box flexGrow={1} />
    </Box>
  );
};

export default Welcome;
