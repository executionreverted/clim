// source/components/Options/TabSelector.js
import React from 'react';
import { Box, Text } from 'ink';

const TabSelector = ({ tabs, activeTab, setActiveTab, width }) => {
  // Calculate even spacing for tabs
  const tabWidth = Math.floor((width - 4) / tabs.length);

  return (
    <Box
      flexDirection="row"
      borderStyle="round"
      borderColor="gray"
      marginBottom={1}
      width={width}
    >
      {tabs.map((tab, index) => (
        <Box
          key={tab.id}
          width={tabWidth}
          paddingX={2}
          paddingY={1}
          backgroundColor={activeTab === index ? 'blue' : undefined}
        >
          <Text
            bold={activeTab === index}
            color={activeTab === index ? 'white' : undefined}
            wrap="truncate"
          >
            {tab.label}
          </Text>
        </Box>
      ))}
    </Box>
  );
};

export default TabSelector;
