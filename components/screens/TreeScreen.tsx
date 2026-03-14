import { useTree } from '@/hooks/useTree';
import { BookmarkTree } from '@/components/shared/BookmarkTree';
import { EmptyTreeState } from '@/components/shared/EmptyTreeState';
import { Button } from '@/components/ui/button';

export default function TreeScreen(): React.JSX.Element {
  const { tree, error } = useTree();
  const hasChildren = tree !== null && tree.children.length > 0;

  return (
    <div data-testid="tree-screen" className="flex flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <h2 className="text-sm font-semibold">Bookmarks</h2>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" disabled aria-label="Add bookmark">
            + Bookmark
          </Button>
          <Button variant="ghost" size="sm" disabled aria-label="Add folder">
            + Folder
          </Button>
        </div>
      </div>
      {error && (
        <p className="px-4 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {hasChildren ? (
        <div className="px-2 py-1">
          <BookmarkTree nodes={tree.children} />
        </div>
      ) : (
        <EmptyTreeState />
      )}
    </div>
  );
}
