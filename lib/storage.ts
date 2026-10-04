"use client";

import { getSupabaseClient } from "@/lib/supabase";

export type VideoRecord = {
  id: string;
  youtubeUrl: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: number | null;
  currentTime: number;
  createdAt: string;
  updatedAt: string;
  notes: string;
  completed: boolean;
};

type VideoRow = {
  user_id: string;
  id: string;
  youtube_url: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: number | null;
  current_time_seconds: number;
  created_at: string;
  updated_at: string;
  notes: string;
  completed: boolean;
};

const LEGACY_STORAGE_KEY = "course-shelf-v1";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeVideo(value: unknown): VideoRecord | null {
  if (!isObject(value) || typeof value.id !== "string") {
    return null;
  }

  const now = new Date().toISOString();
  return {
    id: value.id,
    youtubeUrl: typeof value.youtubeUrl === "string" ? value.youtubeUrl : "",
    title: typeof value.title === "string" ? value.title : "Untitled video",
    description: typeof value.description === "string" ? value.description : "",
    thumbnail: typeof value.thumbnail === "string" ? value.thumbnail : "",
    duration:
      typeof value.duration === "number" && Number.isFinite(value.duration)
        ? value.duration
        : null,
    currentTime:
      typeof value.currentTime === "number" &&
      Number.isFinite(value.currentTime)
        ? value.currentTime
        : 0,
    createdAt:
      typeof value.createdAt === "string" && value.createdAt
        ? value.createdAt
        : now,
    updatedAt:
      typeof value.updatedAt === "string" && value.updatedAt
        ? value.updatedAt
        : now,
    notes: typeof value.notes === "string" ? value.notes : "",
    completed: Boolean(value.completed),
  };
}

function toRow(userId: string, video: VideoRecord): VideoRow {
  return {
    user_id: userId,
    id: video.id,
    youtube_url: video.youtubeUrl,
    title: video.title,
    description: video.description,
    thumbnail: video.thumbnail,
    duration: video.duration,
    current_time_seconds: video.currentTime,
    created_at: video.createdAt,
    updated_at: video.updatedAt,
    notes: video.notes,
    completed: video.completed,
  };
}

function fromRow(row: VideoRow): VideoRecord {
  return {
    id: row.id,
    youtubeUrl: row.youtube_url,
    title: row.title,
    description: row.description,
    thumbnail: row.thumbnail,
    duration: row.duration,
    currentTime: row.current_time_seconds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    notes: row.notes,
    completed: row.completed,
  };
}

async function importLegacyVideos(userId: string) {
  const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) {
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "Your saved browser library could not be read, so it was kept on this device.",
    );
  }

  if (!isObject(parsed) || !Array.isArray(parsed.videos)) {
    throw new Error(
      "Your saved browser library has an unexpected format and was kept on this device.",
    );
  }

  const videos = parsed.videos
    .map((item) => normalizeVideo(item))
    .filter((video): video is VideoRecord => video !== null);

  if (videos.length > 0) {
    const { error } = await getSupabaseClient()
      .from("course_videos")
      .upsert(videos.map((video) => toRow(userId, video)), {
        onConflict: "user_id,id",
        ignoreDuplicates: true,
      });

    if (error) {
      throw error;
    }
  }

  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
}

export async function loadVideos(userId: string): Promise<VideoRecord[]> {
  await importLegacyVideos(userId);

  const { data, error } = await getSupabaseClient()
    .from("course_videos")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data as VideoRow[]).map(fromRow);
}

export async function getVideo(
  userId: string,
  id: string,
): Promise<VideoRecord | null> {
  await importLegacyVideos(userId);

  const { data, error } = await getSupabaseClient()
    .from("course_videos")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? fromRow(data as VideoRow) : null;
}

export async function saveVideo(userId: string, video: VideoRecord) {
  const { error } = await getSupabaseClient()
    .from("course_videos")
    .upsert(toRow(userId, video), { onConflict: "user_id,id" });

  if (error) {
    throw error;
  }
}

export async function updateVideo(
  userId: string,
  id: string,
  updates: Partial<VideoRecord>,
) {
  const row: Partial<VideoRow> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.youtubeUrl !== undefined) row.youtube_url = updates.youtubeUrl;
  if (updates.title !== undefined) row.title = updates.title;
  if (updates.description !== undefined) row.description = updates.description;
  if (updates.thumbnail !== undefined) row.thumbnail = updates.thumbnail;
  if (updates.duration !== undefined) row.duration = updates.duration;
  if (updates.currentTime !== undefined) {
    row.current_time_seconds = updates.currentTime;
  }
  if (updates.createdAt !== undefined) row.created_at = updates.createdAt;
  if (updates.updatedAt !== undefined) row.updated_at = updates.updatedAt;
  if (updates.notes !== undefined) row.notes = updates.notes;
  if (updates.completed !== undefined) row.completed = updates.completed;

  const { data, error } = await getSupabaseClient()
    .from("course_videos")
    .update(row)
    .eq("user_id", userId)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error("This video is no longer in your library.");
  }
}

export async function deleteVideo(userId: string, id: string) {
  const { data, error } = await getSupabaseClient()
    .from("course_videos")
    .delete()
    .eq("user_id", userId)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error("This video is no longer in your library.");
  }
}
