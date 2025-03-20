// app.js
import React, { useState } from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import Welcome from './components/Welcome.js';
import FileExplorer from './components/FileExplorer/index.js';

// Example Chat component to demonstrate file picker integration
const ChatDemo = ({ onBack }) => {
  const [messages, setMessages] = useState([
    { text: "Welcome to the chat demo! Try attaching a file.", type: "system" }
  ]);
  const [attachments, setAttachments] = useState([]);
  const [showFilePicker, setShowFilePicker] = useState(false);

  useInput((input, key) => {
    if (input === 'a') {
      setShowFilePicker(true);
    } else if (input === 'b' && !showFilePicker) {
      onBack();
    } else if (input === 'm') {
      setMessages([...messages, {
        text: "This is an example message. Press 'a' to attach a file.",
        type: "user"
      }]);
    }
  });

  const handleFileSelect = (file) => {
    setAttachments([...attachments, file]);
    setMessages([...messages, {
      text: `Attached file: ${file.name} (${file.path})`,
      type: "system"
    }]);
    setShowFilePicker(false);
  };

  if (showFilePicker) {
    return (
      <FileExplorer
        mode="picker"
        onBack={() => setShowFilePicker(false)}
        onFileSelect={handleFileSelect}
      />
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Chat Demo</Text>

      <Box flexDirection="column" marginY={1} height={15} overflowY="scroll">
        {messages.map((msg, i) => (
          <Text key={i} color={msg.type === "system" ? "cyan" : "green"}>
            {msg.text}
          </Text>
        ))}
      </Box>

      {attachments.length > 0 && (
        <Box flexDirection="column" marginY={1} borderStyle="single" padding={1}>
          <Text bold>Attachments:</Text>
          {attachments.map((file, i) => (
            <Text key={i}>{file.name}</Text>
          ))}
        </Box>
      )}

      <Box marginY={1}>
        <Text>
          Press <Text color="green">a</Text> to attach a file |
          <Text color="green"> m</Text> to send a message |
          <Text color="green"> b</Text> to go back
        </Text>
      </Box>
    </Box>
  );
};

const App = () => {
  const [currentPage, setCurrentPage] = useState('welcome');
  const [selectedOption, setSelectedOption] = useState(0);
  const { exit } = useApp();

  const { stdout } = useStdout();
  const [terminalWidth, setTerminalWidth] = useState(stdout.columns || 100);
  const [terminalHeight, setTerminalHeight] = useState(stdout.rows || 24);

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      exit();
    }

    if (currentPage === 'welcome') {
      if (key.upArrow) {
        setSelectedOption(prev => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setSelectedOption(prev => Math.min(1, prev + 1));
      } else if (key.return) {
        if (selectedOption === 0) {
          setCurrentPage('explorer');
        } else if (selectedOption === 1) {
          setCurrentPage('chat');
        }
      }
    }
  });

  // Update terminal dimensions if they change
  React.useEffect(() => {
    const handleResize = () => {
      setTerminalWidth(stdout.columns);
      setTerminalHeight(stdout.rows);
    };

    stdout.on('resize', handleResize);
    return () => {
      stdout.off('resize', handleResize);
    };
  }, [stdout]);

  const handleFileSelect = (file) => {
    console.log('File selected:', file.path);
    // You could do something with the selected file here
  };

  return (
    <Box
      flexDirection="column"
      width={terminalWidth}
      height={terminalHeight}
    >
      {currentPage === 'welcome' ? (
        <Welcome
          onStart={() => setCurrentPage('explorer')}
          selectedOption={selectedOption}
          width={terminalWidth}
          height={terminalHeight}
        />
      ) : currentPage === 'explorer' ? (
        <FileExplorer
          mode="browse"
          onBack={() => setCurrentPage('welcome')}
          onFileSelect={handleFileSelect}
        />
      ) : (
        <ChatDemo onBack={() => setCurrentPage('welcome')} />
      )}

      {/* Fixed escape info at bottom */}
      <Box
        position="absolute"
        bottom={0}
        left={0}
        width={terminalWidth}
        paddingX={1}
      >
        <Text dimColor>Press ESC or q to exit</Text>
      </Box>
    </Box>
  );
};

export default App;
