export default function WatchLoading() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 md:px-8">
      <div className="mb-8 h-10 animate-pulse border-b border-zinc-200/80" />
      <div className="mb-6 h-9 w-2/3 animate-pulse rounded bg-zinc-200" />
      <div className="aspect-video w-full animate-pulse rounded-2xl bg-zinc-200" />
      <div className="mt-5 h-4 animate-pulse rounded bg-zinc-200" />
      <div className="mt-8 h-40 animate-pulse rounded-2xl bg-zinc-200" />
    </main>
  );
}
