import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

const isStandalone = () => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean(window.navigator.standalone) ||
    window.location.pathname.includes('/pwa')
  );
};

export default function PwaInstallButton() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();

      const supportsInstall =
        !event.platforms ||
        event.platforms.includes('web') ||
        event.platforms.includes('android') ||
        event.platforms.includes('chrome') ||
        event.platforms.includes('edge');

      if (!supportsInstall || isStandalone()) {
        setPromptEvent(null);
        setIsVisible(false);
        return;
      }

      setPromptEvent(event);
      setIsVisible(true);
    };

    const handleAppInstalled = () => {
      setPromptEvent(null);
      setIsVisible(false);
    };

    if (isStandalone()) {
      setPromptEvent(null);
      setIsVisible(false);
      return undefined;
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!promptEvent) {
      setIsVisible(false);
      return;
    }

    try {
      promptEvent.prompt();
      const choiceResult = await promptEvent.userChoice;

      if (choiceResult?.outcome === 'accepted') {
        setIsVisible(false);
      }
    } catch (error) {
      console.error('[PWA Install] failed to trigger install prompt:', error);
    } finally {
      setPromptEvent(null);
      setIsVisible(false);
    }
  };

  if (!isVisible || !promptEvent) return null;

  return (
    <div className="fixed right-3 top-3 z-50 sm:right-4 sm:top-4">
      <Button
        type="button"
        variant="default"
        size="sm"
        onClick={handleInstallClick}
        className="bg-primary text-primary-foreground shadow-lg hover:bg-primary/90"
        aria-label="Install Famo app"
      >
        <Download className="mr-2 h-4 w-4" />
        Install app
      </Button>
    </div>
  );
}
