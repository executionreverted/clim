// app.js
import React, { useState, useEffect } from 'react';
import { Box, Text, useStdout } from 'ink';
import Welcome from './components/Welcome.js';
import FileExplorer from './components/FileExplorer/index.js';
import Chat from './components/Chat/index.js';
import useKeymap from './hooks/useKeymap.js';
import { createExampleConfig } from './utils/keymap.js';

const App = () => {
  const [currentPage, setCurrentPage] = useState('welcome');
  const { stdout } = useStdout();
  const [terminalWidth, setTerminalWidth] = useState(stdout.columns || 100);
  const [terminalHeight, setTerminalHeight] = useState(stdout.rows || 24);

  // Create example config file if it doesn't exist
  useEffect(() => {
    createExampleConfig();
  }, []);

  // Define global keymap handlers
  const handlers = {
    exit: () => process.exit(0),
    back: () => {
      if (currentPage !== 'welcome') {
        setCurrentPage('welcome');
      } else {
        process.exit(0);
      }
    }
  };

  // Use the keymap hook for global actions
  useKeymap('global', handlers);

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
      {currentPage === 'welcome' && (
        <Welcome
          onStart={(w) => setCurrentPage(w)}
          width={terminalWidth}
          height={terminalHeight}
        />
      )}

      {currentPage === 'explorer' && (
        <FileExplorer onBack={() => setCurrentPage('welcome')} />
      )}

      {currentPage === 'chat' && (
        <Chat onBack={() => setCurrentPage('welcome')} />
      )}

      {/* Fixed escape info at bottom */}
      <Box
        position="absolute"
        bottom={0}
        left={0}
        height={1}
        paddingX={1}
      >
        <Text dimColor>Press Esc or Ctrl+q to exit</Text>
      </Box>
    </Box>
  );
};

export default App;
