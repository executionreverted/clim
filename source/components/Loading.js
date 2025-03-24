// components/Loading.js
import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import useThemeUpdate from '../hooks/useThemeUpdate.js';

// Simple loading animation component
const Loading = ({ text = 'Loading', width = 20 }) => {
  const [frame, setFrame] = useState(0);
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const currentTheme = useThemeUpdate();
  const { primaryColor } = currentTheme.colors;

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(prev => (prev + 1) % frames.length);
    }, 100);

    return () => clearInterval(timer);
  }, []);

  return (
    <Box width={width} alignItems="center" justifyContent="center">
      <Text color={primaryColor} bold>
        {frames[frame]} {text}...
      </Text>
    </Box>
  );
};

export default Loading;
