"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useState } from "react";

import AddVideoModal from "@/components/AddVideoModal";
import VideoCard from "@/components/VideoCard";
import {
  deleteVideo,
  readVideos,
  type VideoRecord,
  writeVideos,
} from "@/lib/storage";
import { extractVideoId, getVideoThumbnail } from "@/lib/youtube";

export default function HomePage() {
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VideoRecord | null>(null);

  useEffect(() => {
    setVideos(readVideos());
  }, []);

  const handleSave = ({
    youtubeUrl,
    title,
    description,
  }: {
    youtubeUrl: string;
    title: string;
    description: string;
  }) => {
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      return;
    }

    const savedVideos = readVideos();
    const existing = savedVideos.find((video) => video.id === videoId);
    const now = new Date().toISOString();

    const nextVideo: VideoRecord = existing
      ? {
          ...existing,
          youtubeUrl,
          title: title || existing.title,
          description,
          thumbnail: existing.thumbnail || getVideoThumbnail(videoId),
          updatedAt: now,
        }
      : {
          id: videoId,
          youtubeUrl,
          title: title || "Untitled course",
          description,
          thumbnail: getVideoThumbnail(videoId),
          duration: null,
          currentTime: 0,
          createdAt: now,
          updatedAt: now,
          notes: "",
          completed: false,
        };

    const updatedVideos = existing
      ? savedVideos.map((video) => (video.id === videoId ? nextVideo : video))
      : [nextVideo, ...savedVideos];

    writeVideos(updatedVideos);
    setVideos(updatedVideos);
    setSelectedVideo(null);
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    const videoToDelete = videos.find((video) => video.id === id);
    if (videoToDelete) {
      setDeleteTarget(videoToDelete);
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) {
      return;
    }

    const nextVideos = deleteVideo(deleteTarget.id);
    setVideos(nextVideos);
    setDeleteTarget(null);
  };

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 md:px-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          Course Viewer
        </h1>

        <button
          type="button"
          onClick={() => {
            setSelectedVideo(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-[8px] bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700"
        >
          <FontAwesomeIcon icon={faPlus} className="text-xs" />
          <span>Add Video</span>
        </button>
      </div>

      {videos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center shadow-sm">
          <p className="text-lg font-medium text-zinc-700">
            No saved videos yet.
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Add a YouTube course URL to start your personal library.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {videos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              onEdit={(videoToEdit) => {
                setSelectedVideo(videoToEdit);
                setIsModalOpen(true);
              }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-video-title"
            className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg"
          >
            <h2
              id="delete-video-title"
              className="text-lg font-semibold text-zinc-900"
            >
              Delete this video?
            </h2>
            <p className="mt-2 text-sm text-zinc-600">
              “{deleteTarget.title}” and its saved progress and notes will be
              removed from this device.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-[8px] border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="rounded-[8px] bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
              >
                Delete video
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AddVideoModal
        open={isModalOpen}
        initialVideo={selectedVideo}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedVideo(null);
        }}
        onSave={handleSave}
      />
    </main>
  );
}
