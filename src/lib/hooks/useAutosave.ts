import { useCallback, useEffect, useRef } from 'react';

interface UseAutosaveOptions {
  interval?: number; // Autosave interval in milliseconds (default: 5000ms = 5 seconds)
  enabled?: boolean; // Whether autosave is enabled (default: true)
}

/**
 * Custom React hook for automatic saving with focus/visibility detection
 * 
 * @param saveNote - Callback function to save the note
 * @param options - Configuration options for autosave behavior
 * @returns Object with manual save function and current autosave status
 */
export function useAutosave(
  saveNote: () => Promise<void> | void,
  options: UseAutosaveOptions = {}
) {
  const { interval = 5000, enabled = true } = options;
  
  // Refs to store interval ID and prevent duplicate intervals
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(false);
  const saveNoteRef = useRef(saveNote);
  
  // Update the save function ref when it changes
  useEffect(() => {
    saveNoteRef.current = saveNote;
  }, [saveNote]);

  // Function to clear existing interval
  const clearAutosaveInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      isActiveRef.current = false;
      console.log('🔄 useAutosave: Interval cleared');
    }
  }, []);

  // Function to start autosave interval
  const startAutosaveInterval = useCallback(() => {
    // Clear any existing interval first
    clearAutosaveInterval();
    
    if (!enabled) {
      console.log('🔄 useAutosave: Autosave disabled, not starting interval');
      return;
    }

    console.log(`🔄 useAutosave: Starting autosave interval (${interval}ms)`);
    
    intervalRef.current = setInterval(async () => {
      try {
        console.log('💾 useAutosave: Running scheduled autosave');
        await saveNoteRef.current();
      } catch (error) {
        console.error('💾 useAutosave: Error during scheduled save:', error);
      }
    }, interval);
    
    isActiveRef.current = true;
  }, [interval, enabled, clearAutosaveInterval]);

  // Function to restart autosave (useful when user returns to app)
  const restartAutosave = useCallback(() => {
    console.log('🔄 useAutosave: Restarting autosave interval');
    startAutosaveInterval();
  }, [startAutosaveInterval]);

  // Manual save function
  const manualSave = useCallback(async () => {
    try {
      console.log('💾 useAutosave: Running manual save');
      await saveNoteRef.current();
    } catch (error) {
      console.error('💾 useAutosave: Error during manual save:', error);
      throw error;
    }
  }, []);

  // Handle window focus events
  useEffect(() => {
    const handleFocus = () => {
      console.log('👁️ useAutosave: Window gained focus, restarting autosave');
      restartAutosave();
    };

    const handleBlur = () => {
      console.log('👁️ useAutosave: Window lost focus');
      // Keep autosave running even when window loses focus
      // This ensures notes are saved while user is away
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [restartAutosave]);

  // Handle document visibility change events
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ useAutosave: Document became visible, restarting autosave');
        restartAutosave();
      } else {
        console.log('👁️ useAutosave: Document became hidden');
        // Keep autosave running even when document is hidden
        // This ensures notes are saved while user is on other tabs
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [restartAutosave]);

  // Start autosave when hook is first used
  useEffect(() => {
    if (enabled) {
      startAutosaveInterval();
    }

    // Cleanup on unmount
    return () => {
      clearAutosaveInterval();
    };
  }, [enabled, startAutosaveInterval, clearAutosaveInterval]);

  // Return useful functions and state
  return {
    manualSave,
    restartAutosave,
    clearAutosave: clearAutosaveInterval,
    isActive: isActiveRef.current,
  };
}