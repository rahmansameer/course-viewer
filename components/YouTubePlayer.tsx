"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type YouTubePlayerInstance = {
  destroy?: () => void;
  getCurrentTime?: () => number;
  getDuration?: () => number;
  seekTo?: (seconds: number, allowSeekAhead: boolean) => void;
};

type YouTubePlayerOptions = {
  videoId: string;
  height?: string | number;
  width?: string | number;
  playerVars?: Record<string, number | boolean | string>;
  events?: {
    onReady?: (event: { target: YouTubePlayerInstance }) => void;
    onStateChange?: (event: { data: number }) => void;
    onError?: (event: { data: number }) => void;
  };
};

let youtubeApiPromise: Promise<void> | null = null;

function loadYouTubeIframeApi(): Promise<void> {
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

type YouTubePlayerProps = {
  videoId: string;
  currentTime: number;
  onTimeUpdate: (
    currentTime: number,
    duration: number,
    forcePersist?: boolean,
  ) => void;
};

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
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export default function YouTubePlayer({
  videoId,
  currentTime,
  onTimeUpdate,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const readyRef = useRef(false);
  const saveIntervalRef = useRef<number | null>(null);
  const lastReportedSecondRef = useRef(-1);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const currentTimeRef = useRef(currentTime);
  const [playerError, setPlayerError] = useState("");
  currentTimeRef.current = currentTime;

  const flushProgress = useCallback((forcePersist = false) => {
    const player = playerRef.current;
    if (!readyRef.current || !player?.getCurrentTime) {
      return;
    }

    const current = player.getCurrentTime();
    const duration = player.getDuration?.() ?? 0;
    const currentSecond = Math.floor(current);
    if (!forcePersist && currentSecond === lastReportedSecondRef.current) {
      return;
    }
    lastReportedSecondRef.current = currentSecond;
    onTimeUpdateRef.current(current, duration, forcePersist);
  }, []);

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  useEffect(() => {
    let cancelled = false;
    setPlayerError("");

    const createPlayer = () => {
      if (!containerRef.current || !window.YT?.Player) {
        return;
      }

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        height: "100%",
        width: "100%",
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: (event) => {
            if (!cancelled) {
              readyRef.current = true;
              event.target.seekTo?.(
                Math.max(0, currentTimeRef.current),
                true,
              );
            }
          },
          onStateChange: (event) => {
            const states = window.YT?.PlayerState;
            if (
              event.data === states?.PAUSED ||
              event.data === states?.ENDED
            ) {
              flushProgress(true);
            }
          },
          onError: (event) => {
            if (!cancelled) {
              setPlayerError(
                `YouTube could not play this video (error ${event.data}).`,
              );
            }
          },
        },
      });
    };

    void loadYouTubeIframeApi()
      .then(() => {
        if (!cancelled) {
          createPlayer();
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setPlayerError(
            error instanceof Error
              ? error.message
              : "The YouTube player could not be loaded.",
          );
        }
      });

    return () => {
      cancelled = true;
      flushProgress();
      readyRef.current = false;
      if (saveIntervalRef.current) {
        window.clearInterval(saveIntervalRef.current);
        saveIntervalRef.current = null;
      }
      if (
        playerRef.current &&
        typeof playerRef.current.destroy === "function"
      ) {
        playerRef.current.destroy();
      }
      playerRef.current = null;
    };
  }, [videoId, flushProgress]);

  useEffect(() => {
    saveIntervalRef.current = window.setInterval(flushProgress, 250);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushProgress(true);
      }
    };

    const handleBeforeUnload = () => {
      flushProgress(true);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handleBeforeUnload);

    return () => {
      if (saveIntervalRef.current) {
        window.clearInterval(saveIntervalRef.current);
        saveIntervalRef.current = null;
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handleBeforeUnload);
      flushProgress();
    };
  }, [videoId]);

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 shadow-sm">
      <div ref={containerRef} className="aspect-video w-full" />
      {playerError ? (
        <p role="alert" className="p-3 text-sm text-red-700">
          {playerError}
        </p>
      ) : null}
    </div>
  );
}
