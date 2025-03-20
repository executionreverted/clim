import { measureElement, Box } from 'ink';
import * as React from 'react';

/**
 * A box that can be scrolled vertically
 * @param props - props
 * @param props.children - children elements to be rendered
 * @param props.initialHeight - initial height estimate
 * @param props.offset - scroll offset (number of items to skip from the beginning)
 * @param props.itemHeight - estimated height of each item (default: 1)
 * @param props.renderItem - optional custom render function for each item
 */
export function ScrollBox(props) {
  const {
    children,
    initialHeight = 0,
    offset = 0,
    itemHeight = 1,
    renderItem,
    ...boxProps
  } = props;

  const ref = React.useRef(null);
  const [height, setHeight] = React.useState(initialHeight);

  // Calculate how many items can fit in the view
  const itemsToShow = Math.max(1, Math.floor(height / itemHeight));

  React.useLayoutEffect(() => {
    if (ref && ref.current) {
      setHeight(measureElement(ref.current).height);
    }
  }, [ref, props.height]);

  // If children is an array, slice it correctly
  if (Array.isArray(children)) {
    const visibleItems = children.slice(offset, offset + itemsToShow);

    return (
      <Box {...boxProps} flexDirection="column" ref={ref}>
        {renderItem
          ? visibleItems.map((item, idx) => renderItem(item, idx + offset))
          : visibleItems
        }
      </Box>
    );
  }

  // If not an array, just render the children
  return (
    <Box {...boxProps} flexDirection="column" ref={ref}>
      {children}
    </Box>
  );
}
