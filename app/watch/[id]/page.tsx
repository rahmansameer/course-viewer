"use client";

import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import ProgressBar from "@/components/ProgressBar";
import YouTubePlayer from "@/components/YouTubePlayer";
import { getVideo, updateVideo, type VideoRecord } from "@/lib/storage";
import { formatDuration, formatTime, getProgressPercent } from "@/lib/youtube";

export default function WatchPage() {
  const params = useParams<{ id: string }>();
  const videoId = typeof params?.id === "string" ? params.id : "";
  const [video, setVideo] = useState<VideoRecord | null>(null);
  const videoRef = useRef<VideoRecord | null>(null);
  const lastSavedSnapshotRef = useRef<{
    currentTime: number;
    duration: number | null;
  } | null>(null);

  useEffect(() => {
    lastSavedSnapshotRef.current = null;
    const found = getVideo(videoId);
    setVideo(found);
    videoRef.current = found;
  }, [videoId]);

  const saveProgress = useCallback(
    (currentTime: number, duration: number) => {
      if (!videoRef.current) {
        return;
      }

      const safeDuration =
        duration > 0 ? duration : (videoRef.current.duration ?? null);
      const safeCurrentTime = Number.isFinite(currentTime) ? currentTime : 0;
      const previous = videoRef.current;
      const roundedCurrent = Math.round(safeCurrentTime);
      const lastSnapshot = lastSavedSnapshotRef.current;
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

      updateVideo(videoId, {
        currentTime: safeCurrentTime,
        duration: safeDuration,
        completed: isCompleted,
      });
    },
    [videoId],
  );

  const updateNotes = (notes: string) => {
    if (!videoRef.current) {
      return;
    }

    const nextVideo = { ...videoRef.current, notes };
    setVideo(nextVideo);
    videoRef.current = nextVideo;
    updateVideo(videoId, { notes });
  };

  if (!video) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <div className="w-full rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="text-xl font-semibold text-zinc-900">
            Video not found.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-zinc-700 hover:text-zinc-900"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="text-[12px]" />
            <span>Back Home</span>
          </Link>
        </div>
      </main>
    );
  }

  const progress = getProgressPercent(video.currentTime, video.duration);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 md:px-8">
      <Link
        href="/"
        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-zinc-700 hover:text-zinc-900"
      >
        <FontAwesomeIcon icon={faArrowLeft} className="text-[12px]" />
        <span>Back Home</span>
      </Link>

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
