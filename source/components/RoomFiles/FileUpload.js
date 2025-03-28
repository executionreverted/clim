// Updated FileUpload.js - Simplified for Hyperblobs
import React, { useState } from 'react';
import { Box, Text } from 'ink';
import useThemeUpdate from '../../hooks/useThemeUpdate.js';
import TextInput from '../TextInput.js';
import fs from 'fs';
import path from 'path';

const FileUpload = ({
  isActive = false,
  onClose,
  onUpload
}) => {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const currentTheme = useThemeUpdate();
  const {
    primaryColor,
    secondaryColor,
    errorColor,
    warningColor,
    borderColor
  } = currentTheme.colors;

  const handleInputChange = (value) => {
    setInputValue(value);
    setError(null);
  };

  const handleInputSubmit = async (value) => {
    if (!value.trim()) {
      onClose();
      return;
    }

    try {
      setIsUploading(true);

      // Check if file exists
      if (!fs.existsSync(value)) {
        setError(`File not found: ${value}`);
        setIsUploading(false);
        return;
      }

      // Get file information
      const stats = fs.statSync(value);

      if (stats.isDirectory()) {
        setError("Cannot upload directories with Hyperblobs, only files");
        setIsUploading(false);
        return;
      }

      // Show warning for large files
      if (stats.size > 100 * 1024 * 1024) { // 100MB
        setError("Warning: File is very large. Upload may take a while.");
        // Continue anyway after showing warning
      }

      // Create file object with path
      const file = {
        path: value,
        name: path.basename(value),
        size: stats.size
      };

      // Call onUpload with the file
      await onUpload(file);

      // Close after successful upload
      onClose();
    } catch (err) {
      setError(`Upload failed: ${err.message}`);
      setIsUploading(false);
    }
  };

  if (!isActive) return null;

  return (
    <Box
      position="absolute"
      top="center"
      left="center"
      width={60}
      height={10}
      borderStyle="round"
      borderColor={borderColor}
      backgroundColor="#000"
      padding={1}
      flexDirection="column"
    >
      <Text bold>Upload File</Text>

      <Box marginTop={1}>
        <Text>Enter local file path: </Text>
      </Box>

      <Box marginTop={1}>
        <TextInput
          value={inputValue}
          onChange={handleInputChange}
          onSubmit={handleInputSubmit}
          focus={true}
        />
      </Box>

      {error && (
        <Box marginTop={1}>
          <Text color={errorColor}>{error}</Text>
        </Box>
      )}

      {isUploading ? (
        <Box marginTop={1}>
          <Text color={warningColor}>Uploading...</Text>
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text color={secondaryColor}>
            Press Enter to upload or Esc to cancel
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default FileUpload;
