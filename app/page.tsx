import HomePageContent from "@/components/HomePageContent";

// AuthGate only renders this after hydration, so the dashboard can read the
// tab's cached library during its first render without a hydration mismatch.
export default function HomePage() {
  return <HomePageContent />;
}
