"use client";

export type YouTubePlayerInstance = {
  destroy?: () => void;
  getCurrentTime?: () => number;
  getDuration?: () => number;
  getIframe?: () => HTMLIFrameElement;
  getPlayerState?: () => number;
  isMuted?: () => boolean;
  mute?: () => void;
  pauseVideo?: () => void;
  playVideo?: () => void;
  seekTo?: (seconds: number, allowSeekAhead: boolean) => void;
  unMute?: () => void;
  unloadModule?: (module: string) => void;
};

type YouTubePlayerOptions = {
  videoId?: string;
  height?: string | number;
  width?: string | number;
  playerVars?: Record<string, number | boolean | string>;
  events?: {
    onReady?: (event: { target: YouTubePlayerInstance }) => void;
    onStateChange?: (event: {
      data: number;
      target: YouTubePlayerInstance;
    }) => void;
    onError?: (event: { data: number }) => void;
    onApiChange?: (event: { target: YouTubePlayerInstance }) => void;
  };
};

let youtubeApiPromise: Promise<void> | null = null;

export function loadYouTubeIframeApi(): Promise<void> {
  if (window.YT?.Player) {
    return Promise.resolve();
  }
  if (youtubeApiPromise) {
    return youtubeApiPromise;
  }

  youtubeApiPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try {
        previousCallback?.();
        if (!window.YT?.Player) {
          throw new Error("The YouTube player could not be initialized.");
        }
        resolve();
      } catch (error) {
        reject(error);
      }
    };

    const script = existingScript ?? document.createElement("script");
    script.addEventListener(
      "error",
      () => {
        youtubeApiPromise = null;
        reject(new Error("The YouTube player API could not be loaded."));
      },
      { once: true },
    );
    if (!existingScript) {
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }
  }).catch((error: unknown) => {
    youtubeApiPromise = null;
    throw error;
  });

  return youtubeApiPromise;
}

// Starts downloading the player API ahead of time (e.g. when a course card is
// hovered) so the player can be created as soon as the watch page mounts.
// Failures are ignored here; YouTubePlayer retries and reports them.
export function preloadYouTubeIframeApi() {
  if (typeof window !== "undefined") {
    loadYouTubeIframeApi().catch(() => {});
  }
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string | HTMLElement,
        options: YouTubePlayerOptions,
      ) => YouTubePlayerInstance;
      PlayerState?: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}
