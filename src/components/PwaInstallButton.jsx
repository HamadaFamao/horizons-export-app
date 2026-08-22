import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Share, MoreVertical, Monitor, PlusSquare, Menu as MenuIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const STORAGE_KEY = 'famo-pwa-installed';

// True once the app is actually running as an installed PWA (Chromium's
// display-mode media query, or iOS Safari's legacy navigator.standalone flag).
const isStandaloneDisplay = () => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
};

const hasInstalledFlag = () => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

const markInstalled = () => {
  try {
    window.localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // localStorage unavailable (private browsing, blocked storage, etc.) - safe to ignore.
  }
};

const detectPlatform = () => {
  if (typeof navigator === 'undefined') return 'generic';
  const ua = navigator.userAgent || '';

  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) return 'ios-safari';

  if (/SamsungBrowser/i.test(ua)) return 'samsung';
  if (/Android/i.test(ua)) return 'android-chrome';
  if (/Chrome|Chromium|Edg\//i.test(ua)) return 'desktop-chrome';

  return 'generic';
};

const INSTRUCTIONS = {
  'android-chrome': {
    label: 'Android · Chrome',
    steps: [
      { icon: MoreVertical, text: 'Tap the ⋮ menu in the top-right corner' },
      { icon: PlusSquare, text: 'Choose "Add to Home Screen" or "Install App"' },
    ],
  },
  samsung: {
    label: 'Samsung Internet',
    steps: [
      { icon: MenuIcon, text: 'Open the browser menu' },
      { icon: PlusSquare, text: 'Tap "Add page to"' },
      { icon: Download, text: 'Choose "Home screen"' },
    ],
  },
  'ios-safari': {
    label: 'iPhone · Safari',
    steps: [
      { icon: Share, text: 'Tap the Share button' },
      { icon: PlusSquare, text: 'Choose "Add to Home Screen"' },
    ],
  },
  'desktop-chrome': {
    label: 'Desktop · Chrome',
    steps: [
      { icon: Monitor, text: 'Click the Install icon in the address bar' },
    ],
  },
  generic: {
    label: 'Your browser',
    steps: [
      { icon: MenuIcon, text: 'Open your browser menu' },
      { icon: PlusSquare, text: 'Look for "Install App" or "Add to Home Screen"' },
    ],
  },
};

/**
 * Floating install button for the Famo PWA.
 *
 * Chromium browsers may fire `beforeinstallprompt`, in which case we save the
 * event and trigger the native install flow. Browsers that never fire it
 * (iOS Safari, Firefox, browsers where the prompt already fired once this
 * session, etc.) fall back to a branded modal with manual steps - the button
 * itself is always visible so users always have a way to install.
 */
export default function PwaInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isHidden, setIsHidden] = useState(() => isStandaloneDisplay() || hasInstalledFlag());
  const [showInstructions, setShowInstructions] = useState(false);
  const platform = useMemo(() => detectPlatform(), []);

  useEffect(() => {
    if (isStandaloneDisplay() || hasInstalledFlag()) {
      setIsHidden(true);
      return undefined;
    }

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const handleAppInstalled = () => {
      markInstalled();
      setDeferredPrompt(null);
      setShowInstructions(false);
      setIsHidden(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = useCallback(async () => {
    // Native install flow first, whenever the browser has offered it.
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice?.outcome === 'accepted') {
          markInstalled();
          setIsHidden(true);
        }
      } catch {
        // Prompt could not be shown (already consumed, browser quirk, etc.) -
        // the manual instructions modal remains available on the next click.
      } finally {
        setDeferredPrompt(null);
      }
      return;
    }

    // No native prompt available - fall back to manual instructions.
    setShowInstructions(true);
  }, [deferredPrompt]);

  if (isHidden) return null;

  const instructions = INSTRUCTIONS[platform] ?? INSTRUCTIONS.generic;

  return (
    <>
      <div className="fixed z-[60] right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:right-6 md:bottom-6">
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r from-rose-500 to-orange-500 animate-pwa-pulse-ring"
          />
          <Button
            type="button"
            onClick={handleInstallClick}
            aria-label="Install Famo app"
            className="relative h-auto gap-2 rounded-full px-5 py-3.5 text-sm font-semibold text-white shadow-xl shadow-rose-500/30 bg-gradient-to-r from-rose-500 via-pink-500 to-orange-500 hover:from-rose-600 hover:via-pink-600 hover:to-orange-600 transition-transform duration-300 hover:scale-105 active:scale-95"
          >
            <Download className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Install App</span>
            <span className="sm:hidden">Install</span>
          </Button>
        </div>
      </div>

      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="max-w-sm rounded-2xl sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-orange-500 shadow-lg shadow-rose-500/30">
              <Download className="h-6 w-6 text-white" />
            </div>
            <DialogTitle className="text-center text-xl">Install Famo</DialogTitle>
            <DialogDescription className="text-center">
              Add Famo to your home screen for a faster, full-screen experience.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {instructions.label}
            </p>
            <ol className="space-y-2">
              {instructions.steps.map(({ icon: Icon, text }, index) => (
                <li
                  key={text}
                  className="flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-2.5"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-orange-500 text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <Icon className="h-4 w-4 shrink-0 text-rose-500" />
                  <span className="text-sm text-foreground">{text}</span>
                </li>
              ))}
            </ol>
          </div>

          <Button
            type="button"
            onClick={() => setShowInstructions(false)}
            className="w-full rounded-full bg-gradient-to-r from-rose-500 via-pink-500 to-orange-500 text-white hover:from-rose-600 hover:via-pink-600 hover:to-orange-600"
          >
            Got it
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
