// app.js
import React, { useState, useEffect } from 'react';
import { Box, Text, useStdout } from 'ink';
import Welcome from './components/Welcome.js';
import FileExplorer from './components/FileExplorer/index.js';
import Chat from './components/Chat/index.js';
import Options from './components/Options/index.js';
import useKeymap from './hooks/useKeymap.js';
import { createExampleConfig } from './utils/keymap.js';
import { ThemeProvider } from './contexts/ThemeContext.js';
import { createThemeSystem } from './utils/theme.js';

// Main App component
const App = () => {
  const [currentPage, setCurrentPage] = useState('welcome');
  const { stdout } = useStdout();
  const [terminalWidth, setTerminalWidth] = useState(stdout.columns || 100);
  const [terminalHeight, setTerminalHeight] = useState(stdout.rows || 24);

  // Create example config and theme files if they don't exist
  useEffect(() => {
    createExampleConfig();
    createThemeSystem();
  }, []);

  // Define global keymap handlers
  const handlers = {
    exit: () => process.exit(0),
  };

  // Add welcome screen handlers
  const welcomeHandlers = {
    startChat: () => setCurrentPage('chat'),
    startExplorer: () => setCurrentPage('explorer'),
    startOptions: () => setCurrentPage('options')
  };

  // Use the keymap hook for global actions
  useKeymap('global', handlers);

  // Use the welcome keymap when on welcome screen
  useKeymap('welcome', welcomeHandlers, { isActive: currentPage === 'welcome' });

  // Update terminal dimensions if they change
  useEffect(() => {
    const handleResize = () => {
      setTerminalWidth(stdout.columns - 1);
      setTerminalHeight(stdout.rows - 1);
    };

    stdout.on('resize', handleResize);
    return () => {
      stdout.off('resize', handleResize);
    };
  }, []);

  return (
    <ThemeProvider>
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

        {currentPage === 'options' && (
          <Options onBack={() => setCurrentPage('welcome')} />
        )}
      </Box>
    </ThemeProvider>
  );
};

export default App;
