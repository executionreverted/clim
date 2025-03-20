// app.js
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import Welcome from './components/Welcome.js';
import FileExplorer from './components/FileExplorer/index.js';

const App = () => {
  const [currentPage, setCurrentPage] = useState('welcome');
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [terminalWidth, setTerminalWidth] = useState(stdout.columns || 100);
  const [terminalHeight, setTerminalHeight] = useState(stdout.rows || 24);

  // Exit on 'q' or ESC
  useInput((input, key) => {
    if (key.escape || input === 'q') {
      exit();
    }
  });

  // Update terminal dimensions if they change
  useEffect(() => {
    const handleResize = () => {
      setTerminalWidth(stdout.columns);
      setTerminalHeight(stdout.rows);
    };

    stdout.on('resize', handleResize);
    return () => {
      stdout.off('resize', handleResize);
    };
  }, [stdout]);

  return (
    <Box
      flexDirection="column"
      width={terminalWidth}
      height={terminalHeight}
    >
      {currentPage === 'welcome' ? (
        <Welcome
          onStart={() => setCurrentPage('explorer')}
          width={terminalWidth}
          height={terminalHeight}
        />
      ) : (
        <FileExplorer onBack={() => setCurrentPage('welcome')} />
      )}

      {/* Fixed escape info at bottom */}
      <Box
        position="absolute"
        bottom={0}
        left={0}
        height={1}
        paddingX={1}
      >
        <Text dimColor>Press ESC or q to exit</Text>
      </Box>
    </Box>
  );
};

export default App;
