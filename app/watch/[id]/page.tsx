import WatchPage from "@/components/WatchPage";

// The page reads its data in the browser, so every video shares one static
// shell. Returning no params generates it on first request and caches it,
// which lets <Link> prefetch the whole route for instant navigation.
export function generateStaticParams() {
  return [];
}

export default function Page() {
  return <WatchPage />;
}
