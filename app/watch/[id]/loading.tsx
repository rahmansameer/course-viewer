import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";

export default function WatchLoading() {
  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <nav className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700"
        >
          <FontAwesomeIcon icon={faArrowLeft} className="text-xs" />
          Dashboard
        </Link>
      </nav>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(20rem,1fr)] xl:gap-8">
        <div>
          <div className="aspect-video w-full animate-pulse rounded-2xl bg-zinc-200" />
          <div className="mt-5 h-8 w-2/3 animate-pulse rounded bg-zinc-200" />
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-zinc-200" />
      </div>
    </main>
  );
}
