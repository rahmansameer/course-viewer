"use client";

import { useEffect, useRef } from "react";

type YouTubePlayerProps = {
  videoId: string;
  currentTime: number;
  onTimeUpdate: (currentTime: number, duration: number) => void;
};

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string | HTMLElement,
        options: {
          videoId: string;
          height?: string | number;
          width?: string | number;
          playerVars?: Record<string, number | boolean | string>;
          events?: {
            onReady?: (event: {
              target: {
                seekTo: (seconds: number, allowSeekAhead: boolean) => void;
                playVideo: () => void;
              };
            }) => void;
            onStateChange?: (event: { data: number }) => void;
            onError?: (event: { data: number }) => void;
          };
        },
      ) => unknown;
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
  const playerRef = useRef<any>(null);
  const saveIntervalRef = useRef<number | null>(null);
  const onTimeUpdateRef = useRef(onTimeUpdate);

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  useEffect(() => {
    let cancelled = false;

    const createPlayer = () => {
      if (
        !containerRef.current ||
        typeof window === "undefined" ||
        !window.YT ||
        !window.YT.Player
      ) {
        return;
      }

      if (playerRef.current) {
        playerRef.current.destroy();
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
              event.target.seekTo(Math.max(0, currentTime), true);
            }
          },
          onStateChange: (event) => {
            if (event.data === window.YT?.PlayerState?.ENDED) {
              const duration = playerRef.current?.getDuration?.() ?? 0;
              onTimeUpdate(duration, duration);
            }
          },
        },
      });
    };

    const loadApi = () => {
      if (typeof window === "undefined") {
        return;
      }

      if (window.YT && window.YT.Player) {
        createPlayer();
        return;
      }

      const existingScript = document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]',
      );
      if (!existingScript) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        tag.async = true;
        document.body.appendChild(tag);
      }

      window.onYouTubeIframeAPIReady = () => {
        if (!cancelled) {
          createPlayer();
        }
      };
    };

    loadApi();

    return () => {
      cancelled = true;
      if (saveIntervalRef.current) {
        window.clearInterval(saveIntervalRef.current);
      }
      if (
        playerRef.current &&
        typeof playerRef.current.destroy === "function"
      ) {
        playerRef.current.destroy();
      }
    };
  }, [videoId]);

  useEffect(() => {
    if (!playerRef.current) {
      return;
    }

    const player = playerRef.current;
    const current = player.getCurrentTime ? player.getCurrentTime() : 0;
    if (Math.abs(current - currentTime) > 1) {
      player.seekTo?.(Math.max(0, currentTime), true);
    }
  }, [currentTime, videoId]);

  useEffect(() => {
    const flushProgress = () => {
      const player = playerRef.current;
      if (!player || typeof player.getCurrentTime !== "function") {
        return;
      }

      const current = player.getCurrentTime();
      const duration = player.getDuration ? player.getDuration() : 0;
      onTimeUpdateRef.current(current, duration);
    };

    saveIntervalRef.current = window.setInterval(flushProgress, 4000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushProgress();
      }
    };

    const handleBeforeUnload = () => {
      flushProgress();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      if (saveIntervalRef.current) {
        window.clearInterval(saveIntervalRef.current);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      flushProgress();
    };
  }, [videoId]);

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 shadow-sm">
      <div ref={containerRef} className="aspect-video w-full" />
    </div>
  );
}
