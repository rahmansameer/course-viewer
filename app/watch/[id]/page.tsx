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

import { useAuth } from "@/components/AuthGate";
import YouTubePlayer from "@/components/YouTubePlayer";
import {
  cacheVideo,
  clearCachedVideo,
  getCachedVideo,
  getCachedVideos,
  getPlaybackCheckpoint,
  getVideo,
  savePlaybackCheckpoint,
  updateVideo,
  type VideoRecord,
} from "@/lib/storage";

export default function WatchPage() {
  const params = useParams<{ id: string }>();
  const videoId = typeof params?.id === "string" ? params.id : "";
  const { user, cachedUserIdHint } = useAuth();
  const userId = user?.id;
  const cacheUserId = userId ?? cachedUserIdHint;
  const [video, setVideo] = useState<VideoRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isWidePlayer, setIsWidePlayer] = useState(false);
  const videoRef = useRef<VideoRecord | null>(null);
  const videoOwnerRef = useRef("");
  const progressSaveRef = useRef<Promise<void>>(Promise.resolve());
  const lastRemoteProgressSaveRef = useRef(0);
  const notesSaveTimeoutRef = useRef<number | null>(null);
  const pendingNotesRef = useRef<string | null>(null);
  const lastSavedSnapshotRef = useRef<{
    currentTime: number;
    duration: number | null;
  } | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "t" ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest("input, textarea, select, [contenteditable='true']"))
      ) {
        return;
      }

      event.preventDefault();
      setIsWidePlayer((isWide) => !isWide);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const restorePlaybackCheckpoint = useCallback(
    (found: VideoRecord | null) => {
      if (!found || !cacheUserId) {
        return found;
      }

      const checkpoint = getPlaybackCheckpoint(cacheUserId, videoId);
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
    [cacheUserId, videoId],
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
    if (!cacheUserId || !videoId) {
      return;
    }

    lastSavedSnapshotRef.current = null;
    videoOwnerRef.current = `${cacheUserId}:${videoId}`;
    try {
      const cachedVideo =
        getCachedVideo(cacheUserId, videoId) ??
        getCachedVideos(cacheUserId)?.find((item) => item.id === videoId) ??
        null;
      const cached = restorePlaybackCheckpoint(cachedVideo);
      if (cached) {
        videoRef.current = cached;
        setVideo(cached);
        lastSavedSnapshotRef.current = {
          currentTime: Math.round(cached.currentTime),
          duration: cached.duration,
        };
        setLoading(false);
        setError("");
      } else {
        videoRef.current = null;
        setVideo(null);
      }
    } catch (cacheError) {
      setError(
        cacheError instanceof Error
          ? cacheError.message
          : "The cached video could not be restored.",
      );
    }
  }, [cacheUserId, videoId, restorePlaybackCheckpoint]);

  const saveProgress = useCallback(
    (currentTime: number, duration: number, forcePersist = false) => {
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
        if (!forcePersist) {
          return;
        }
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

      const now = Date.now();
      if (
        !forcePersist &&
        now - lastRemoteProgressSaveRef.current < 5000
      ) {
        return;
      }
      lastRemoteProgressSaveRef.current = now;
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
    return null;
  }

  if (!video) {
    return (
      <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
        <nav className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 transition hover:text-zinc-950"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="text-xs" />
            Dashboard
          </Link>
        </nav>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
            <p className="text-xl font-semibold text-zinc-900">
              {error ? "Could not load video." : "Video not found."}
            </p>
            {error ? (
              <p role="alert" className="mt-2 text-sm text-red-600">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className={
        isWidePlayer
          ? "h-dvh overflow-hidden"
          : "min-h-screen px-4 py-5 sm:px-6 lg:px-8"
      }
    >
      {!isWidePlayer ? (
        <nav className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 transition hover:text-zinc-950"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="text-xs" />
            Dashboard
          </Link>
        </nav>
      ) : null}

      <div
        className={`grid items-stretch gap-6 xl:gap-8 ${
          isWidePlayer
            ? "h-full min-h-0 grid-cols-1"
            : "lg:grid-cols-[minmax(0,3fr)_minmax(20rem,1fr)]"
        }`}
      >
        <section className={isWidePlayer ? "h-full min-h-0 min-w-0" : "min-w-0"}>
          <YouTubePlayer
            videoId={video.id}
            currentTime={video.currentTime}
            expanded={isWidePlayer}
            onToggleExpanded={() => setIsWidePlayer((isWide) => !isWide)}
            onTimeUpdate={saveProgress}
          />
        </section>

        <aside className={isWidePlayer ? "hidden" : "min-w-0 lg:flex"}>
          <section className="flex flex-1 flex-col rounded-2xl border border-zinc-200 bg-white p-4">
            <label
              htmlFor="notes"
              className="mb-3 block text-sm font-medium text-zinc-900"
            >
              Notes
            </label>
            <textarea
              id="notes"
              value={video.notes}
              onChange={(event) => updateNotes(event.target.value)}
              rows={8}
              placeholder="Write something here..."
              className="w-full flex-1 resize-none rounded-lg border-0 bg-transparent px-0 py-1 text-sm leading-6 text-zinc-900 outline-none placeholder:text-zinc-400 focus:bg-transparent lg:min-h-0"
            />
          </section>
        </aside>
      </div>

      {!isWidePlayer && video.description ? (
        <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-zinc-600">
          {video.description}
        </p>
      ) : null}
      {!isWidePlayer && error ? (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}
    </main>
  );
}
