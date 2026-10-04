export function extractVideoId(url: string): string | null {
  const value = url.trim();
  if (!value) return null;

  try {
    const parsed = new URL(value);
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return isValidVideoId(id) ? id : null;
    }

    if (
      parsed.hostname.includes("youtube.com") ||
      parsed.hostname.includes("www.youtube.com")
    ) {
      const id = parsed.searchParams.get("v");
      return id && isValidVideoId(id) ? id : null;
    }
  } catch {
    // URL constructor can fail for malformed strings.
  }

  const shortMatch = value.match(/youtu\.be\/([A-Za-z0-9_-]{11})/i);
  if (shortMatch) return shortMatch[1];

  const standardMatch = value.match(/[?&]v=([A-Za-z0-9_-]{11})/i);
  if (standardMatch) return standardMatch[1];

  return null;
}

export function isValidVideoId(value: string): boolean {
  return /^[A-Za-z0-9_-]{11}$/.test(value);
}

export function getVideoThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function formatTime(seconds: number | null | undefined): string {
  if (
    !Number.isFinite(seconds) ||
    seconds === null ||
    seconds === undefined ||
    seconds < 0
  ) {
    return "00:00";
  }

  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hrs > 0) {
    return [hrs, mins, secs]
      .map((value) => value.toString().padStart(2, "0"))
      .join(":");
  }

  return [mins, secs]
    .map((value) => value.toString().padStart(2, "0"))
    .join(":");
}

export function formatDuration(seconds: number | null | undefined): string {
  return formatTime(seconds);
}

export function getProgressPercent(
  currentTime: number,
  duration: number | null,
): number {
  if (!duration || duration <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, (currentTime / duration) * 100));
}
