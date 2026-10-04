"use client";

import { useEffect, useState } from "react";

import { type VideoRecord } from "@/lib/storage";
import { extractVideoId } from "@/lib/youtube";

type AddVideoModalProps = {
  open: boolean;
  initialVideo: VideoRecord | null;
  onClose: () => void;
  onSave: (values: {
    youtubeUrl: string;
    title: string;
    description: string;
  }) => Promise<void>;
};

export default function AddVideoModal({
  open,
  initialVideo,
  onClose,
  onSave,
}: AddVideoModalProps) {
  const [youtubeUrl, setYoutubeUrl] = useState(initialVideo?.youtubeUrl ?? "");
  const [title, setTitle] = useState(initialVideo?.title ?? "");
  const [description, setDescription] = useState(
    initialVideo?.description ?? "",
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setYoutubeUrl(initialVideo?.youtubeUrl ?? "");
    setTitle(initialVideo?.title ?? "");
    setDescription(initialVideo?.description ?? "");
    setError("");
  }, [open, initialVideo]);

  if (!open) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedUrl = youtubeUrl.trim();
    const videoId = extractVideoId(trimmedUrl);

    if (!trimmedUrl || !videoId) {
      setError("Please paste a valid YouTube single-video URL.");
      return;
    }

    const nextTitle = title.trim();
    const nextDescription = description.trim();

    setSaving(true);
    setError("");
    try {
      await onSave({
        youtubeUrl: trimmedUrl,
        title: nextTitle || "Untitled course",
        description: nextDescription,
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The video could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-zinc-900">
            {initialVideo ? "Edit video" : "Add a video"}
          </h2>
          <button
            type="button"
            className="cursor-pointer text-sm text-zinc-500 transition hover:text-zinc-800"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="youtube-url"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              Paste YouTube video URL
            </label>
            <input
              id="youtube-url"
              value={youtubeUrl}
              onChange={(event) => setYoutubeUrl(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white"
            />
          </div>

          <div>
            <label
              htmlFor="video-title"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              Title
            </label>
            <input
              id="video-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Course title"
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white"
            />
          </div>

          <div>
            <label
              htmlFor="video-description"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              Description (optional)
            </label>
            <textarea
              id="video-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              placeholder="Optional notes or summary"
              className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-[8px] border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="cursor-pointer rounded-[8px] bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
            >
              {saving
                ? "Saving..."
                : initialVideo
                  ? "Save changes"
                  : "Add video"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
