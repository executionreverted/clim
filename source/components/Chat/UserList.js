// components/Chat/UserList.js
import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { useChat } from '../../contexts/ChatContext.js';
import useKeymap from '../../hooks/useKeymap.js';

const UserList = ({ width = 20, height = 20, isFocused = false }) => {
  const { activeRoom, inputMode } = useChat();
  const users = activeRoom.users || [];

  const [scrollOffset, setScrollOffset] = useState(0);
  const maxVisibleUsers = Math.max(3, height - 3);

  // Define handlers for user list navigation
  const handlers = {
    navigateUp: () => {
      setScrollOffset(Math.max(0, scrollOffset - 1));
    },
    navigateDown: () => {
      setScrollOffset(Math.min(
        Math.max(0, users.length - maxVisibleUsers),
        scrollOffset + 1
      ));
    }
  };

  // Use the keymap hook
  useKeymap('chat', handlers, {
    isActive: isFocused && !inputMode
  });

  const visibleUsers = users.slice(
    scrollOffset,
    scrollOffset + maxVisibleUsers
  );

  return (
    <Box
      width={width}
      height={height}
      borderStyle="single"
      borderColor={isFocused ? "green" : "gray"}
      flexDirection="column"
      padding={1}
    >
      <Box>
        <Text bold underline wrap="truncate">
          Online Users ({users.length})
        </Text>
      </Box>

      {users.length === 0 ? (
        <Box>
          <Text color="gray" italic>
            No users in this room
          </Text>
        </Box>
      ) : (
        <>
          {scrollOffset > 0 && (
            <Box>
              <Text color="yellow">↑ More users</Text>
            </Box>
          )}

          {visibleUsers.map((user, index) => (
            <Box key={index}>
              <Text
                color={user === 'You' ? 'green' : undefined}
                bold={user === 'You'}
                wrap="truncate"
              >
                {isFocused ? '•' : ' '} {user}
              </Text>
            </Box>
          ))}

          {scrollOffset + maxVisibleUsers < users.length && (
            <Box>
              <Text color="yellow">↓ More users</Text>
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default UserList;
