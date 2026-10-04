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

type StoredLibrary = {
  videos: VideoRecord[];
};

const STORAGE_KEY = "course-shelf-v1";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeVideo(value: unknown): VideoRecord | null {
  if (!isObject(value) || typeof value.id !== "string") {
    return null;
  }

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
        : new Date().toISOString(),
    updatedAt:
      typeof value.updatedAt === "string" && value.updatedAt
        ? value.updatedAt
        : new Date().toISOString(),
    notes: typeof value.notes === "string" ? value.notes : "",
    completed: Boolean(value.completed),
  };
}

export function readVideos(): VideoRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!isObject(parsed) || !Array.isArray(parsed.videos)) {
      return [];
    }

    const videos = parsed.videos
      .map((item) => normalizeVideo(item))
      .filter((value): value is VideoRecord => Boolean(value));

    return videos;
  } catch {
    return [];
  }
}

export function writeVideos(videos: VideoRecord[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const payload: StoredLibrary = { videos };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures and keep the UI responsive.
  }
}

export function getVideo(id: string): VideoRecord | null {
  return readVideos().find((video) => video.id === id) ?? null;
}

export function updateVideo(id: string, updates: Partial<VideoRecord>) {
  const current = readVideos();
  const next = current.map((video) =>
    video.id === id
      ? {
          ...video,
          ...updates,
          updatedAt: new Date().toISOString(),
        }
      : video,
  );

  writeVideos(next);
  return next;
}

export function deleteVideo(id: string) {
  const next = readVideos().filter((video) => video.id !== id);
  writeVideos(next);
  return next;
}

export function upsertVideo(video: VideoRecord) {
  const current = readVideos();
  const existingIndex = current.findIndex((item) => item.id === video.id);

  if (existingIndex >= 0) {
    const merged = [...current];
    merged[existingIndex] = { ...merged[existingIndex], ...video };
    writeVideos(merged);
    return merged;
  }

  const next = [video, ...current];
  writeVideos(next);
  return next;
}
