"use client";

import {
  faCompress,
  faExpand,
  faPause,
  faPlay,
  faVolumeHigh,
  faVolumeXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useEffect, useRef, useState } from "react";

import { formatTime } from "@/lib/youtube";

type YouTubePlayerInstance = {
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
};

type YouTubePlayerOptions = {
  videoId: string;
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

type VideoTimelineProps = {
  currentTime: number;
  duration: number;
  isPlayerReady: boolean;
  isPlaying: boolean;
  getCurrentTime: () => number;
  seekTo: (seconds: number, forcePersist?: boolean) => void;
};

function VideoTimeline({
  currentTime,
  duration,
  isPlayerReady,
  isPlaying,
  getCurrentTime,
  seekTo,
}: VideoTimelineProps) {
  const [displayTime, setDisplayTime] = useState(currentTime);
  const scrubbingRef = useRef(false);
  const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;
  const progress = safeDuration > 0 ? displayTime / safeDuration : 0;

  useEffect(() => {
    if (!isPlayerReady || isPlaying || !Number.isFinite(currentTime)) {
      return;
    }
    setDisplayTime(Math.max(0, currentTime));
  }, [currentTime, isPlayerReady, isPlaying]);

  useEffect(() => {
    if (!isPlayerReady || !isPlaying) {
      return;
    }

    let frameId = 0;
    let lastUpdate = 0;
    const updatePlayhead = (timestamp: number) => {
      if (timestamp - lastUpdate >= 1000 / 30) {
        lastUpdate = timestamp;
        if (!scrubbingRef.current) {
          const playerTime = getCurrentTime();
          if (Number.isFinite(playerTime)) {
            setDisplayTime(Math.max(0, playerTime));
          }
        }
      }
      frameId = window.requestAnimationFrame(updatePlayhead);
    };

    frameId = window.requestAnimationFrame(updatePlayhead);
    return () => window.cancelAnimationFrame(frameId);
  }, [getCurrentTime, isPlayerReady, isPlaying]);

  const handleSeekChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    scrubbingRef.current = true;
    setDisplayTime(Number(event.currentTarget.value));
  };

  const commitSeek = (event: React.SyntheticEvent<HTMLInputElement>) => {
    if (!scrubbingRef.current) {
      return;
    }

    const targetTime = Number(event.currentTarget.value);
    scrubbingRef.current = false;
    setDisplayTime(targetTime);
    seekTo(targetTime, true);
  };

  return (
    <>
      <span className="shrink-0 text-sm font-medium tabular-nums text-zinc-700">
        {formatTime(displayTime)} / {formatTime(safeDuration)}
      </span>
      <div className="relative flex h-5 min-w-0 flex-1 items-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 overflow-hidden rounded-full bg-zinc-200"
        >
          <div
            className="h-full origin-left rounded-full bg-zinc-900"
            style={{
              transform: `scaleX(${Math.min(1, Math.max(0, progress))})`,
            }}
          />
        </div>
        <input
          type="range"
          aria-label="Seek video"
          aria-valuetext={`${formatTime(displayTime)} of ${formatTime(safeDuration)}`}
          min={0}
          max={safeDuration || 1}
          step={0.1}
          value={Math.min(displayTime, safeDuration || 1)}
          disabled={!isPlayerReady || safeDuration <= 0}
          onPointerDown={() => {
            scrubbingRef.current = true;
          }}
          onPointerUp={commitSeek}
          onPointerCancel={commitSeek}
          onChange={handleSeekChange}
          onKeyUp={commitSeek}
          onBlur={commitSeek}
          className="youtube-seekbar relative z-10 h-5 w-full cursor-pointer disabled:cursor-not-allowed"
        />
      </div>
    </>
  );
}

export default function YouTubePlayer({
  videoId,
  currentTime,
  onTimeUpdate,
}: YouTubePlayerProps) {
  const playerShellRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const readyRef = useRef(false);
  const saveIntervalRef = useRef<number | null>(null);
  const lastReportedSecondRef = useRef(-1);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const currentTimeRef = useRef(currentTime);
  const durationRef = useRef(0);
  const [playerError, setPlayerError] = useState("");
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");
  currentTimeRef.current = currentTime;

  const readDuration = useCallback((player: YouTubePlayerInstance) => {
    const nextDuration = player.getDuration?.() ?? 0;
    if (
      Number.isFinite(nextDuration) &&
      nextDuration > 0 &&
      nextDuration !== durationRef.current
    ) {
      durationRef.current = nextDuration;
      setDuration(nextDuration);
    }
    return durationRef.current;
  }, []);

  const flushProgress = useCallback((forcePersist = false) => {
    const player = playerRef.current;
    if (!readyRef.current || !player?.getCurrentTime) {
      return;
    }

    const current = player.getCurrentTime();
    const duration = readDuration(player);
    const currentSecond = Math.floor(current);
    if (!forcePersist && currentSecond === lastReportedSecondRef.current) {
      return;
    }
    lastReportedSecondRef.current = currentSecond;
    onTimeUpdateRef.current(current, duration, forcePersist);
  }, [readDuration]);

  const seekTo = useCallback(
    (seconds: number, forcePersist = false) => {
      const player = playerRef.current;
      if (!readyRef.current || !player?.seekTo) {
        return;
      }

      const playerDuration = readDuration(player);
      const targetTime = Math.max(
        0,
        playerDuration > 0 ? Math.min(playerDuration, seconds) : seconds,
      );
      player.seekTo(targetTime, true);
      lastReportedSecondRef.current = -1;
      onTimeUpdateRef.current(targetTime, playerDuration, forcePersist);
    },
    [readDuration],
  );

  const seekBy = useCallback(
    (seconds: number) => {
      const player = playerRef.current;
      const current = player?.getCurrentTime?.() ?? currentTimeRef.current;
      seekTo(current + seconds, true);
    },
    [seekTo],
  );

  const getCurrentTime = useCallback(
    () => playerRef.current?.getCurrentTime?.() ?? currentTimeRef.current,
    [],
  );

  const togglePlayback = useCallback(() => {
    if (!isPlayerReady) {
      return;
    }

    if (isPlaying) {
      playerRef.current?.pauseVideo?.();
    } else {
      playerRef.current?.playVideo?.();
    }
  }, [isPlayerReady, isPlaying]);

  const toggleMute = useCallback(() => {
    const player = playerRef.current;
    if (!isPlayerReady || !player) {
      return;
    }

    if (isMuted) {
      player.unMute?.();
    } else {
      player.mute?.();
    }
    setIsMuted(!isMuted);
  }, [isMuted, isPlayerReady]);

  const toggleFullscreen = useCallback(async () => {
    const playerShell = playerShellRef.current;
    if (!isPlayerReady || !playerShell) {
      return;
    }

    setFullscreenError("");
    try {
      if (document.fullscreenElement === playerShell) {
        await document.exitFullscreen();
      } else if (!document.fullscreenElement) {
        await playerShell.requestFullscreen();
      }
    } catch (error) {
      setFullscreenError(
        error instanceof Error
          ? error.message
          : "Fullscreen could not be enabled.",
      );
    }
  }, [isPlayerReady]);

  useEffect(() => {
    const updateFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement === playerShellRef.current);
    };
    document.addEventListener("fullscreenchange", updateFullscreenState);
    return () =>
      document.removeEventListener("fullscreenchange", updateFullscreenState);
  }, []);

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isSeekSlider =
        target instanceof HTMLInputElement && target.type === "range";
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (target instanceof HTMLElement &&
          (target.isContentEditable ||
            target.closest(
              "input:not([type='range']), textarea, select, [contenteditable='true']",
            )))
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      if (event.key === " " || key === "k") {
        event.preventDefault();
        togglePlayback();
      } else if (key === "f") {
        event.preventDefault();
        void toggleFullscreen();
      } else if (key === "j") {
        event.preventDefault();
        seekBy(-10);
      } else if (key === "l") {
        event.preventDefault();
        seekBy(10);
      } else if (!isSeekSlider && event.key === "ArrowLeft") {
        event.preventDefault();
        seekBy(-5);
      } else if (!isSeekSlider && event.key === "ArrowRight") {
        event.preventDefault();
        seekBy(5);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [seekBy, toggleFullscreen, togglePlayback]);

  useEffect(() => {
    let cancelled = false;
    setPlayerError("");
    setIsPlayerReady(false);
    setIsPlaying(false);
    setDuration(0);
    durationRef.current = 0;
    lastReportedSecondRef.current = -1;

    const createPlayer = () => {
      if (!containerRef.current || !window.YT?.Player) {
        return;
      }

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        height: "100%",
        width: "100%",
        playerVars: {
          controls: 0,
          disablekb: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: (event) => {
            if (!cancelled) {
              readyRef.current = true;
              setIsPlayerReady(true);
              readDuration(event.target);
              setIsPlaying(
                event.target.getPlayerState?.() ===
                  window.YT?.PlayerState?.PLAYING,
              );
              setIsMuted(event.target.isMuted?.() ?? false);
              event.target.seekTo?.(
                Math.max(0, currentTimeRef.current),
                true,
              );
            }
          },
          onStateChange: (event) => {
            const states = window.YT?.PlayerState;
            setIsPlaying(event.data === states?.PLAYING);
            readDuration(event.target);
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
  }, [videoId, flushProgress, readDuration]);

  useEffect(() => {
    saveIntervalRef.current = window.setInterval(flushProgress, 1000);

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
  }, [videoId, flushProgress]);

  return (
    <div
      ref={playerShellRef}
      className="youtube-player-shell overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 shadow-sm"
    >
      <div className="youtube-video-frame relative aspect-video w-full bg-black">
        <div ref={containerRef} className="h-full w-full" />
        {!isPlayerReady && !playerError ? (
          <div
            role="status"
            aria-label="Loading video"
            className="absolute inset-0 z-10 grid place-items-center bg-black text-sm text-white/70"
          >
            <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/25 border-t-white/90" />
          </div>
        ) : null}
      </div>
      {isPlayerReady || playerError ? (
        <div
          role="group"
          aria-label="Video controls. Space or K plays and pauses, F toggles fullscreen, J rewinds 10 seconds, L skips forward 10 seconds, and the left and right arrow keys seek by 5 seconds."
          className="flex items-center gap-1 border-t border-zinc-200 bg-white px-2 py-1 text-zinc-900"
        >
          <div className="flex shrink-0 items-center gap-0">
            <button
              type="button"
              aria-label={isPlaying ? "Pause video" : "Play video"}
              title={isPlaying ? "Pause video" : "Play video"}
              disabled={!isPlayerReady}
              onClick={togglePlayback}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[15px] text-zinc-800 transition hover:bg-zinc-100 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FontAwesomeIcon
                icon={isPlaying ? faPause : faPlay}
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              aria-label={isMuted ? "Unmute video" : "Mute video"}
              title={isMuted ? "Unmute" : "Mute"}
              disabled={!isPlayerReady}
              onClick={toggleMute}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[15px] text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FontAwesomeIcon
                icon={isMuted ? faVolumeXmark : faVolumeHigh}
                aria-hidden="true"
              />
            </button>
          </div>
          <VideoTimeline
            key={videoId}
            currentTime={currentTime}
            duration={duration}
            isPlayerReady={isPlayerReady}
            isPlaying={isPlaying}
            getCurrentTime={getCurrentTime}
            seekTo={seekTo}
          />
          <button
            type="button"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={isFullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
            disabled={!isPlayerReady}
            onClick={() => void toggleFullscreen()}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[15px] text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FontAwesomeIcon
              icon={isFullscreen ? faCompress : faExpand}
              aria-hidden="true"
            />
          </button>
        </div>
      ) : null}
      {playerError ? (
        <p role="alert" className="p-3 text-sm text-red-700">
          {playerError}
        </p>
      ) : null}
      {fullscreenError ? (
        <p role="alert" className="p-3 text-sm text-red-700">
          {fullscreenError}
        </p>
      ) : null}
    </div>
  );
}
