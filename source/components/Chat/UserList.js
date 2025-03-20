// components/Chat/UserList.js
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useChat } from '../../contexts/ChatContext.js';

const UserList = ({ width = 20, height = 20, isFocused = false }) => {
  const { activeRoom } = useChat();
  const users = activeRoom.users || [];

  const [scrollOffset, setScrollOffset] = useState(0);
  const maxVisibleUsers = Math.max(3, height - 3);

  useInput((input, key) => {
    if (!isFocused) return;

    if (key.upArrow) {
      setScrollOffset(Math.max(0, scrollOffset - 1));
    } else if (key.downArrow) {
      setScrollOffset(Math.min(
        Math.max(0, users.length - maxVisibleUsers),
        scrollOffset + 1
      ));
    }
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
