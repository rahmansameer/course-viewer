"use client";

import dynamic from "next/dynamic";

const HomePageContent = dynamic(() => import("@/components/HomePageContent"), {
  ssr: false,
  loading: () => null,
});

export default function HomePageLoader() {
  return <HomePageContent />;
}
