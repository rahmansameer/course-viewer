"use client";

import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { AccountButton, useAuth } from "@/components/AuthGate";
import ProgressBar from "@/components/ProgressBar";
import YouTubePlayer from "@/components/YouTubePlayer";
import {
  cacheVideo,
  clearCachedVideo,
  getCachedVideo,
  getPlaybackCheckpoint,
  getVideo,
  savePlaybackCheckpoint,
  updateVideo,
  type VideoRecord,
} from "@/lib/storage";
import { formatDuration, formatTime, getProgressPercent } from "@/lib/youtube";

export default function WatchPage() {
  const params = useParams<{ id: string }>();
  const videoId = typeof params?.id === "string" ? params.id : "";
  const { user } = useAuth();
  const userId = user?.id;
  const [video, setVideo] = useState<VideoRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const videoRef = useRef<VideoRecord | null>(null);
  const videoOwnerRef = useRef("");
  const progressSaveRef = useRef<Promise<void>>(Promise.resolve());
  const notesSaveTimeoutRef = useRef<number | null>(null);
  const pendingNotesRef = useRef<string | null>(null);
  const lastSavedSnapshotRef = useRef<{
    currentTime: number;
    duration: number | null;
  } | null>(null);

  const restorePlaybackCheckpoint = useCallback(
    (found: VideoRecord | null) => {
      if (!found || !userId) {
        return found;
      }

      const checkpoint = getPlaybackCheckpoint(userId, videoId);
      const serverUpdatedAt = Date.parse(found.updatedAt);
      if (
        !checkpoint ||
        (Number.isFinite(serverUpdatedAt) &&
          checkpoint.savedAt <= serverUpdatedAt)
      ) {
        return found;
      }

      return {
        ...found,
        currentTime: checkpoint.currentTime,
        duration: checkpoint.duration ?? found.duration,
        completed: checkpoint.duration
          ? checkpoint.currentTime >= checkpoint.duration - 1
          : found.completed,
      };
    },
    [userId, videoId],
  );

  useEffect(() => {
    if (!userId || !videoId) {
      return;
    }

    let cancelled = false;
    setError("");
    const owner = `${userId}:${videoId}`;
    if (videoOwnerRef.current !== owner) {
      videoOwnerRef.current = owner;
      videoRef.current = null;
      setVideo(null);
      lastSavedSnapshotRef.current = null;
      setLoading(true);
    }

    void getVideo(userId, videoId)
      .then((found) => {
        if (!cancelled) {
          const restored = restorePlaybackCheckpoint(found);
          setVideo(restored);
          videoRef.current = restored;
          lastSavedSnapshotRef.current = restored
            ? {
                currentTime: Math.round(restored.currentTime),
                duration: restored.duration,
              }
            : null;
          if (restored) {
            cacheVideo(userId, restored);
          } else {
            clearCachedVideo(userId, videoId);
          }
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "This video could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [videoId, userId, restorePlaybackCheckpoint]);

  useLayoutEffect(() => {
    if (!userId || !videoId) {
      return;
    }

    lastSavedSnapshotRef.current = null;
    videoOwnerRef.current = `${userId}:${videoId}`;
    try {
      const cached = restorePlaybackCheckpoint(getCachedVideo(userId, videoId));
      if (cached) {
        videoRef.current = cached;
        setVideo(cached);
        lastSavedSnapshotRef.current = {
          currentTime: Math.round(cached.currentTime),
          duration: cached.duration,
        };
        setLoading(false);
      } else {
        videoRef.current = null;
        setVideo(null);
        setLoading(true);
      }
    } catch (cacheError) {
      setError(
        cacheError instanceof Error
          ? cacheError.message
          : "The cached video could not be restored.",
      );
      setLoading(true);
    }
  }, [userId, videoId, restorePlaybackCheckpoint]);

  const saveProgress = useCallback(
    (currentTime: number, duration: number) => {
      if (!videoRef.current || !userId) {
        return;
      }

      const safeDuration =
        duration > 0 ? duration : (videoRef.current.duration ?? null);
      const safeCurrentTime = Number.isFinite(currentTime) ? currentTime : 0;
      const previous = videoRef.current;
      const roundedCurrent = Math.round(safeCurrentTime);
      const lastSnapshot = lastSavedSnapshotRef.current;
      try {
        cacheVideo(userId, {
          ...previous,
          currentTime: safeCurrentTime,
          duration: safeDuration,
        });
        savePlaybackCheckpoint(userId, videoId, safeCurrentTime, safeDuration);
      } catch (checkpointError) {
        setError(
          checkpointError instanceof Error
            ? checkpointError.message
            : "Playback progress could not be saved on this device.",
        );
      }
      const isSameProgress =
        previous &&
        lastSnapshot &&
        lastSnapshot.currentTime === roundedCurrent &&
        lastSnapshot.duration === safeDuration;

      if (isSameProgress) {
        return;
      }

      const isCompleted = safeDuration
        ? safeCurrentTime >= safeDuration - 1
        : false;

      const nextVideo: VideoRecord = {
        ...previous,
        currentTime: safeCurrentTime,
        duration: safeDuration,
        updatedAt: new Date().toISOString(),
        completed: isCompleted,
      };

      lastSavedSnapshotRef.current = {
        currentTime: roundedCurrent,
        duration: safeDuration,
      };
      videoRef.current = nextVideo;
      setVideo((prev) => {
        if (!prev || prev.id !== videoId) {
          return prev;
        }

        const prevRounded = Math.round(prev.currentTime);
        if (prevRounded === roundedCurrent && prev.duration === safeDuration) {
          return prev;
        }

        return nextVideo;
      });

      progressSaveRef.current = progressSaveRef.current
        .then(() =>
          updateVideo(userId, videoId, {
            currentTime: safeCurrentTime,
            duration: safeDuration,
            completed: isCompleted,
          }),
        )
        .catch((saveError: unknown) => {
          setError(
            saveError instanceof Error
              ? saveError.message
              : "Playback progress could not be saved.",
          );
        });
    },
    [userId, videoId],
  );

  const persistNotes = useCallback(
    (notes: string) => {
      if (!userId) {
        return;
      }
      void updateVideo(userId, videoId, { notes }).catch(
        (saveError: unknown) => {
          setError(
            saveError instanceof Error
              ? saveError.message
              : "Your notes could not be saved.",
          );
        },
      );
    },
    [userId, videoId],
  );

  const updateNotes = (notes: string) => {
    if (!videoRef.current) {
      return;
    }

    const nextVideo = { ...videoRef.current, notes };
    if (userId) {
      try {
        cacheVideo(userId, nextVideo);
      } catch (cacheError) {
        setError(
          cacheError instanceof Error
            ? cacheError.message
            : "The video could not be cached in this tab.",
        );
      }
    }
    setVideo(nextVideo);
    videoRef.current = nextVideo;
    pendingNotesRef.current = notes;
    if (notesSaveTimeoutRef.current !== null) {
      window.clearTimeout(notesSaveTimeoutRef.current);
    }
    notesSaveTimeoutRef.current = window.setTimeout(() => {
      pendingNotesRef.current = null;
      notesSaveTimeoutRef.current = null;
      persistNotes(notes);
    }, 500);
  };

  useEffect(
    () => () => {
      if (notesSaveTimeoutRef.current !== null) {
        window.clearTimeout(notesSaveTimeoutRef.current);
        notesSaveTimeoutRef.current = null;
        if (pendingNotesRef.current !== null) {
          persistNotes(pendingNotesRef.current);
          pendingNotesRef.current = null;
        }
      }
    },
    [persistNotes],
  );

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <p className="text-sm text-zinc-600">Loading your video...</p>
      </main>
    );
  }

  if (!video) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <div className="w-full rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="text-xl font-semibold text-zinc-900">
            {error ? "Could not load video." : "Video not found."}
          </p>
          {error ? (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {error}
            </p>
          ) : null}
          <Link
            href="/"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-zinc-700 hover:text-zinc-900"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="text-[12px]" />
            <span>Courses</span>
          </Link>
        </div>
      </main>
    );
  }

  const progress = getProgressPercent(video.currentTime, video.duration);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 md:px-8">
      <header className="mb-8 flex items-center justify-between border-b border-zinc-200/80 pb-5">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-medium text-zinc-700 transition hover:text-zinc-950"
        >
          <FontAwesomeIcon icon={faArrowLeft} className="text-[12px]" />
          <span>Courses</span>
        </Link>
        <AccountButton />
      </header>

      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          {video.title}
        </h1>
      </div>

      <YouTubePlayer
        videoId={video.id}
        currentTime={video.currentTime}
        onTimeUpdate={saveProgress}
      />
      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-5 space-y-4">
        <div className="flex items-center justify-between gap-3 text-sm text-zinc-700">
          <span>
            {formatTime(video.currentTime)} /{" "}
            {video.duration ? formatDuration(video.duration) : "--:--"}
          </span>
          <span>{Math.round(progress)}% complete</span>
        </div>

        <ProgressBar
          currentTime={video.currentTime}
          duration={video.duration}
        />

        {video.description ? (
          <p className="text-sm text-zinc-600">{video.description}</p>
        ) : null}
      </div>

      <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <label
          htmlFor="notes"
          className="mb-2 block text-sm font-medium text-zinc-800"
        >
          Notes
        </label>
        <textarea
          id="notes"
          value={video.notes}
          onChange={(event) => updateNotes(event.target.value)}
          rows={5}
          placeholder="Write something here..."
          className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white"
        />
      </div>
    </main>
  );
}
