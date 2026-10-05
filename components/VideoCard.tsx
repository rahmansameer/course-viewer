"use client";

import Link from "next/link";

import { type VideoRecord } from "@/lib/storage";
import { formatDuration, formatTime, getProgressPercent } from "@/lib/youtube";

import ProgressBar from "@/components/ProgressBar";

type VideoCardProps = {
  video: VideoRecord;
  onEdit: (video: VideoRecord) => void;
  onDelete: (id: string) => void;
};

export default function VideoCard({ video, onEdit, onDelete }: VideoCardProps) {
  const percent = getProgressPercent(video.currentTime, video.duration);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-colors hover:border-zinc-300">
      <div className="absolute right-3 top-3 z-10 flex gap-2">
        <button
          type="button"
          className="cursor-pointer rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[10px] font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
          onClick={(event) => {
            event.stopPropagation();
            onEdit(video);
          }}
        >
          Edit
        </button>
        <button
          type="button"
          className="cursor-pointer rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[10px] font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(video.id);
          }}
        >
          Delete
        </button>
      </div>

      <Link
        href={`/watch/${video.id}`}
        className="block cursor-pointer"
      >
        <div className="relative aspect-video overflow-hidden bg-zinc-200">
          {video.thumbnail ? (
            <img
              src={video.thumbnail}
              alt={video.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              No thumbnail
            </div>
          )}
        </div>

        <div className="space-y-3 p-4 pt-5">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              {video.title}
            </h2>
            {video.description ? (
              <p className="mt-1 line-clamp-2 text-sm text-zinc-600">
                {video.description}
              </p>
            ) : null}
          </div>

          <ProgressBar
            currentTime={video.currentTime}
            duration={video.duration}
          />

          <div className="flex items-center justify-between text-xs text-zinc-600">
            <span>
              {formatTime(video.currentTime)} /{" "}
              {video.duration ? formatDuration(video.duration) : "--:--"}
            </span>
            <span>{Math.round(percent)}%</span>
          </div>

          <div className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-800">
            {video.currentTime > 0 ? "Continue" : "Watch"}
          </div>
        </div>
      </Link>
    </div>
  );
}
