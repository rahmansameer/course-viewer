export const AUTH_SESSION_HINT_COOKIE = "course-viewer-session";

export function setAuthSessionHint(userId: string | null) {
  if (typeof document === "undefined") {
    return;
  }

  const maxAge = userId ? 60 * 60 * 24 * 365 : 0;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${AUTH_SESSION_HINT_COOKIE}=${userId ?? ""}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}
