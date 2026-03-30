
import React, { createContext, useState, useContext } from 'react';

const MiniRoomContext = createContext(undefined);

export function MiniRoomProvider({ children }) {
  const [miniRoomActive, setMiniRoomActive] = useState(false);
  const [roomData, setRoomData] = useState(null);

  const value = {
    miniRoomActive,
    setMiniRoomActive,
    roomData,
    setRoomData,
  };

  return (
    <MiniRoomContext.Provider value={value}>
      {children}
    </MiniRoomContext.Provider>
  );
}

export function useMiniRoom() {
  const context = useContext(MiniRoomContext);
  if (context === undefined) {
    throw new Error('useMiniRoom must be used within a MiniRoomProvider');
  }
  return context;
}
