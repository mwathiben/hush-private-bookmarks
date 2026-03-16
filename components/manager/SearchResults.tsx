import { findItemPath } from '@/lib/data-model';
import { BookmarkItem } from '@/components/shared/BookmarkItem';
import type { Bookmark, BookmarkTree } from '@/lib/types';
import type { ItemAction } from '@/components/shared/BookmarkTree';

interface SearchResultsProps {
  readonly results: readonly Bookmark[];
  readonly tree: BookmarkTree;
  readonly onAction: (action: ItemAction) => void;
}

export function SearchResults({
  results,
  tree,
  onAction,
}: SearchResultsProps): React.JSX.Element {
  if (results.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground" data-testid="search-empty">
        No bookmarks match your search
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-0.5" data-testid="search-results">
      {results.map((bookmark) => {
        const pathResult = findItemPath(tree, bookmark.id);
        if (!pathResult.success) return null;
        return (
          <BookmarkItem
            key={bookmark.id}
            bookmark={bookmark}
            path={pathResult.data}
            onAction={onAction}
          />
        );
      })}
    </div>
  );
}
