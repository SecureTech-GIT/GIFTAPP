import { useEffect, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTranslation } from 'react-i18next';

interface UsePromptDialogOptions {
  when: boolean;
  message?: string;
  title?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export function usePromptDialog({ 
  when, 
  message = 'You have unsaved changes. Are you sure you want to leave?',
  title = 'Unsaved Changes',
  onConfirm,
  onCancel
}: UsePromptDialogOptions) {
  const [showDialog, setShowDialog] = useState(false);
  const {t} = useTranslation()
  
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => 
      when && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker.state === 'blocked') {
      setShowDialog(true);
    }
  }, [blocker.state]);

  const handleProceed = () => {
    setShowDialog(false);
    onConfirm?.();
    blocker.proceed?.();
  };

  const handleCancel = () => {
    setShowDialog(false);
    onCancel?.();
    blocker.reset?.();
  };

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

  const DialogComponent = showDialog ? (
    <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={handleProceed}>{t('common.leavePage')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : null;

  return { DialogComponent };
}
