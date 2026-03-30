import React, { createContext, useContext, useState, useCallback } from 'react';

const UnsavedChangesContext = createContext();

export const UnsavedChangesProvider = ({ children }) => {
  const [isDirty, setIsDirty] = useState(false);

  const setDirty = useCallback((value) => {
    // Only log if the value actually changes to reduce noise
    setIsDirty((prev) => {
      if (prev !== value) {
        console.log(`[UnsavedChangesContext] isDirty changed from ${prev} to ${value}`);
      }
      return value;
    });
  }, []);

  return (
    <UnsavedChangesContext.Provider value={{ isDirty, setDirty }}>
      {children}
    </UnsavedChangesContext.Provider>
  );
};

export const useUnsavedChanges = () => {
  const context = useContext(UnsavedChangesContext);
  if (!context) {
    throw new Error('useUnsavedChanges must be used within an UnsavedChangesProvider');
  }
  return context;
};