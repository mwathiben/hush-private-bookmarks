import { memo } from 'react';
import type { Bookmark } from '@/lib/types';

interface BookmarkItemProps {
  readonly bookmark: Bookmark;
}

export const BookmarkItem = memo(function BookmarkItem({
  bookmark,
}: BookmarkItemProps): React.JSX.Element {
  function handleClick(): void {
    void browser.tabs.create({ url: bookmark.url });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-muted"
      aria-label={bookmark.title}
    >
      <span className="truncate text-sm">{bookmark.title}</span>
      <span className="truncate text-xs text-muted-foreground">{bookmark.url}</span>
    </button>
  );
});
