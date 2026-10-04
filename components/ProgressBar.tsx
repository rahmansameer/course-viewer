type ProgressBarProps = {
  currentTime: number;
  duration: number | null;
};

export default function ProgressBar({
  currentTime,
  duration,
}: ProgressBarProps) {
  const safeDuration = duration && duration > 0 ? duration : 0;
  const percentage =
    safeDuration > 0
      ? Math.min(100, Math.max(0, (currentTime / safeDuration) * 100))
      : 0;

  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-zinc-200">
      <div
        className="h-full rounded-full bg-zinc-900 transition-all duration-200"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
