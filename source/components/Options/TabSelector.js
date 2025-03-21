// source/components/Options/TabSelector.js
import React from 'react';
import { Box, Text } from 'ink';
import useThemeUpdate from '../../hooks/useThemeUpdate.js';

const TabSelector = ({
  tabs,
  activeTab,
  setActiveTab,
  width,
  borderColor,
  activeColor
}) => {
  // Get theme context

  const currentTheme = useThemeUpdate();
  // Use props or theme defaults
  const useBorderColor = borderColor || currentTheme.colors.border.inactive;
  const useActiveColor = activeColor || currentTheme.colors.primary;

  // Calculate even spacing for tabs
  const tabWidth = Math.floor((width - 4) / tabs.length);

  return (
    <Box
      flexDirection="row"
      borderStyle="round"
      borderColor={useBorderColor}
      marginBottom={1}
      width={width}
    >
      {tabs.map((tab, index) => {
        const isActive = activeTab === index;

        return (
          <Box
            key={tab.id}
            width={tabWidth}
            paddingX={1}
            paddingY={1}
            backgroundColor={isActive ? useActiveColor : undefined}
          >
            <Text
              bold={isActive}
              color={isActive ? 'white' : undefined}
              wrap="truncate"
            >
              {tab.label}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};

export default TabSelector;
