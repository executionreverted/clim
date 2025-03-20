import { measureElement, Box } from 'ink';
import * as React from 'react';


/**
 * a box that can be scrolled
 * add border is not recommended
 *
 * @param props - props
 */
export function ScrollBox(props) {
  const { children, initialHeight = 0, offset, ...boxProps } = props;

  const ref = React.useRef(null);

  const [height, setHeight] = React.useState(initialHeight);

  React.useLayoutEffect(() => {
    if (ref && ref.current) {
      setHeight(measureElement(ref.current).height);
    }
  }, [ref, props.height]);

  return (
    <Box {...boxProps} flexDirection="column" ref={ref}>
      {children.slice(offset, height + offset)}
    </Box>
  );
}
