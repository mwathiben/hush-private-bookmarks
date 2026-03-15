import { memo } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Bookmark } from '@/lib/types';
import type { ItemAction } from '@/components/shared/BookmarkTree';

interface BookmarkItemProps {
  readonly bookmark: Bookmark;
  readonly path?: readonly number[];
  readonly onAction?: (action: ItemAction) => void;
}

export const BookmarkItem = memo(function BookmarkItem({
  bookmark,
  path,
  onAction,
}: BookmarkItemProps): React.JSX.Element {
  function handleClick(): void {
    void browser.tabs.create({ url: bookmark.url });
  }

  return (
    <div className="group flex items-center gap-1">
      <button
        type="button"
        onClick={handleClick}
        className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-muted"
        aria-label={bookmark.title}
      >
        <span className="truncate text-sm">{bookmark.title}</span>
        <span className="truncate text-xs text-muted-foreground">{bookmark.url}</span>
      </button>
      {onAction && path && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="size-8 shrink-0 p-0 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
              aria-label="Actions"
            >
              <MoreHorizontal />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => onAction({ type: 'edit-bookmark', path: [...path], bookmark })}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAction({ type: 'move', path: [...path], node: bookmark })}>
                Move to...
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => onAction({ type: 'delete', path: [...path], node: bookmark })}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
});
