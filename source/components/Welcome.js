// components/Welcome.js
import React from 'react';
import { Box, Text, useInput } from 'ink';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';

const Welcome = ({ onStart, width = 100, height = 24 }) => {
  useInput((input, key) => {
    if (input === 'c') {
      onStart('chat');
    } else if (input === 'e') {
      onStart('explorer')
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
        <BigText text="Termin4LHub" align="center" font="block" />
      </Gradient>

      <Box marginY={1}>
        <Text>A simple terminal app</Text>
      </Box>

      <Box marginY={2} padding={1} borderStyle="round" borderColor="green">

        <Text>Press <Text color="green" bold>c</Text> to start p2p chat</Text>
        <Text>Press <Text color="green" bold>e</Text> to start exploring files</Text>
      </Box>

      <Box flexGrow={1} />
    </Box>
  );
};

export default Welcome;
