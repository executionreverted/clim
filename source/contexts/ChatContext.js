// contexts/ChatContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';

const ChatContext = createContext();

export const useChat = () => useContext(ChatContext);

// Mock data for demo
const MOCK_ROOMS = [
  { id: '1', name: 'General', messages: [], users: ['Alice', 'Bob', 'Charlie'] },
  { id: '2', name: 'Support', messages: [], users: ['Dave', 'Eve', 'Support Bot'] },
  { id: '3', name: 'Random', messages: [], users: ['Frank', 'Grace', 'Heidi'] },
];

// Generate some mock messages
MOCK_ROOMS.forEach(room => {
  const users = [...room.users];
  const messageCount = 10 + Math.floor(Math.random() * 20);

  for (let i = 0; i < messageCount; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    const timestamp = new Date(Date.now() - (messageCount - i) * 1000 * 60 * 5);

    room.messages.push({
      id: `${room.id}-msg-${i}`,
      user,
      text: `This is a message from ${user} in ${room.name} room. Message #${i + 1}`,
      timestamp
    });
  }
});

export const ChatProvider = ({ children, onBack }) => {
  const [rooms, setRooms] = useState(MOCK_ROOMS);
  const [activeRoomId, setActiveRoomId] = useState(MOCK_ROOMS[0].id);
  const [inputValue, setInputValue] = useState('');
  const [focusedPanel, setFocusedPanel] = useState('messages'); // 'rooms', 'messages', 'users', 'input'
  const [inputMode, setInputMode] = useState(false);

  const activeRoom = rooms.find(room => room.id === activeRoomId) || rooms[0];

  const sendMessage = (text) => {
    if (!text.trim()) return;

    const newMessage = {
      id: `${activeRoomId}-msg-${Date.now()}`,
      user: 'You',
      text,
      timestamp: new Date()
    };

    const updatedRooms = rooms.map(room => {
      if (room.id === activeRoomId) {
        return {
          ...room,
          messages: [...room.messages, newMessage]
        };
      }
      return room;
    });

    setRooms(updatedRooms);
    setInputValue('');
  };

  const createRoom = (name) => {
    if (!name.trim()) return;

    const newRoom = {
      id: `room-${Date.now()}`,
      name,
      messages: [],
      users: ['You']
    };

    setRooms([...rooms, newRoom]);
    setActiveRoomId(newRoom.id);
  };

  const handleKeyInput = (input) => {
    if (focusedPanel === 'rooms' && input === 'a') {
      setInputMode(true);
      setInputValue('');
      return true; // Handled
    }
    return false; // Not handled
  };

  const handleInputSubmit = () => {
    if (focusedPanel === 'rooms' && inputMode) {
      createRoom(inputValue);
      setInputMode(false);
      setInputValue('');
      return true;
    } else if (focusedPanel === 'messages' || focusedPanel === 'input') {
      sendMessage(inputValue);
      return true;
    }
    return false;
  };

  return (
    <ChatContext.Provider
      value={{
        rooms,
        activeRoom,
        activeRoomId,
        setActiveRoomId,
        inputValue,
        setInputValue,
        focusedPanel,
        setFocusedPanel,
        inputMode,
        setInputMode,
        sendMessage,
        createRoom,
        handleKeyInput,
        handleInputSubmit,
        onBack
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export default ChatContext;
