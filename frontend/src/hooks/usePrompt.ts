import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

interface UsePromptOptions {
  when: boolean;
  message?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export function usePrompt({ 
  when, 
  message = 'You have unsaved changes. Are you sure you want to leave?',
  onConfirm,
  onCancel
}: UsePromptOptions) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => 
      when && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker.state === 'blocked') {
      const proceed = window.confirm(message);
      
      if (proceed) {
        onConfirm?.();
        blocker.proceed();
      } else {
        onCancel?.();
        blocker.reset();
      }
    }
  }, [blocker, message, onConfirm, onCancel]);

  // Handle browser refresh/close
  useEffect(() => {
    if (when) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = message;
        return message;
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [when, message]);
}
