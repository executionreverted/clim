// components/common/ScrollableList.js
import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';

/**
 * A reusable component for rendering scrollable lists with pagination
 *
 * @param {Object} props - Component props
 * @param {Array} props.items - Array of items to render
 * @param {Function} props.renderItem - Function to render each item
 * @param {number} props.selectedIndex - Currently selected item index
 * @param {Function} props.onSelectionChange - Callback when selection changes
 * @param {number} props.maxVisibleItems - Maximum number of items to show
 * @param {number} props.width - Width of the component
 * @param {string} props.title - Optional title
 * @param {boolean} props.isFocused - Whether the component is focused
 * @param {Function} props.headerComponent - Optional custom header component
 * @param {Function} props.footerComponent - Optional custom footer component
 * @param {boolean} props.showScrollIndicators - Whether to show scroll indicators
 */
const ScrollableList = ({
  items = [],
  renderItem,
  selectedIndex = 0,
  onSelectionChange,
  maxVisibleItems = 10,
  width = 40,
  title,
  isFocused = false,
  headerComponent: HeaderComponent,
  footerComponent: FooterComponent,
  showScrollIndicators = true,
  borderColor = 'gray',
  scrollUpIndicator = '↑ More items above',
  scrollDownIndicator = '↓ More'
}) => {
  const [visibleStartIndex, setVisibleStartIndex] = useState(0);

  // Ensure selected item is visible
  useEffect(() => {
    if (selectedIndex < 0) return;

    // If selected item is above visible area
    if (selectedIndex < visibleStartIndex) {
      setVisibleStartIndex(selectedIndex);
    }
    // If selected item is below visible area
    else if (selectedIndex >= visibleStartIndex + maxVisibleItems) {
      setVisibleStartIndex(selectedIndex - maxVisibleItems + 1);
    }
  }, [selectedIndex, visibleStartIndex, maxVisibleItems]);

  // Navigation handlers
  const handleNavigateUp = useCallback(() => {
    if (selectedIndex > 0) {
      onSelectionChange(selectedIndex - 1);
    }
  }, [selectedIndex, onSelectionChange]);

  const handleNavigateDown = useCallback(() => {
    if (selectedIndex < items.length - 1) {
      onSelectionChange(selectedIndex + 1);
    }
  }, [selectedIndex, items.length, onSelectionChange]);

  const handlePageUp = useCallback(() => {
    const newIndex = Math.max(0, selectedIndex - maxVisibleItems);
    onSelectionChange(newIndex);
  }, [selectedIndex, maxVisibleItems, onSelectionChange]);

  const handlePageDown = useCallback(() => {
    const newIndex = Math.min(items.length - 1, selectedIndex + maxVisibleItems);
    onSelectionChange(newIndex);
  }, [selectedIndex, items.length, maxVisibleItems, onSelectionChange]);

  // Get visible items
  const visibleItems = items.slice(
    visibleStartIndex,
    visibleStartIndex + maxVisibleItems
  );

  // Whether to show scroll indicators
  const showUpIndicator = showScrollIndicators && visibleStartIndex > 0;
  const showDownIndicator = showScrollIndicators &&
    visibleStartIndex + maxVisibleItems < items.length;

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle="single"
      borderColor={isFocused ? "green" : borderColor}
      padding={1}
    >
      {/* Title or custom header */}
      {title && (
        <Box marginBottom={1}>
          <Text bold underline wrap="truncate">
            {title}
          </Text>
        </Box>
      )}

      {HeaderComponent && <HeaderComponent />}

      {/* Empty state */}
      {items.length === 0 ? (
        <Box width={width - 4}>
          <Text color="yellow" wrap="truncate">No items to display</Text>
        </Box>
      ) : (
        <>
          {/* Up scroll indicator */}
          {showUpIndicator && (
            <Box width={width - 4}>
              <Text color="yellow" wrap="truncate">{scrollUpIndicator}</Text>
            </Box>
          )}

          {/* Visible items */}
          {visibleItems.map((item, index) => (
            <Box key={`item-${visibleStartIndex + index}`} width={width - 4}>
              {renderItem(item, visibleStartIndex + index)}
            </Box>
          ))}

          {/* Down scroll indicator */}
          {showDownIndicator && (
            <Box width={width - 4}>
              <Text color="yellow" wrap="truncate">
                {scrollDownIndicator} ({items.length - visibleStartIndex - maxVisibleItems})
              </Text>
            </Box>
          )}
        </>
      )}

      {/* Custom footer */}
      {FooterComponent && <FooterComponent />}
    </Box>
  );
};

export default ScrollableList;
