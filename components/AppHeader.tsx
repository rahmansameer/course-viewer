"use client";

import { faPlus } from "@fortawesome/free-solid-svg-icons";

import Icon from "@/components/Icon";
import { AccountButton } from "@/components/AuthGate";

type AppHeaderProps = {
  onAddVideo?: () => void;
};

export default function AppHeader({ onAddVideo }: AppHeaderProps) {
  return (
    <header className="mb-6 flex items-center justify-between gap-2 border-b border-zinc-200/80 pb-4 sm:gap-4 sm:pb-5">
      <h1 className="whitespace-nowrap text-3xl font-semibold tracking-tight text-zinc-900">
        My Courses
      </h1>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {onAddVideo ? (
          <button
            type="button"
            aria-label="Add video"
            onClick={onAddVideo}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 sm:gap-2 sm:px-4"
          >
            <Icon icon={faPlus} className="text-xs" />
            <span className="sm:hidden">Add</span>
            <span className="hidden sm:inline">Add Video</span>
          </button>
        ) : null}
        <AccountButton />
      </div>
    </header>
  );
}
