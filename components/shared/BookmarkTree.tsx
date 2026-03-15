import { Accordion } from '@/components/ui/accordion';
import { BookmarkItem } from '@/components/shared/BookmarkItem';
import { FolderItem } from '@/components/shared/FolderItem';
import { isBookmark, isFolder } from '@/lib/data-model';
import type { Bookmark, BookmarkNode, Folder } from '@/lib/types';

export type ItemAction =
  | { readonly type: 'delete'; readonly path: readonly number[]; readonly node: BookmarkNode }
  | { readonly type: 'edit-bookmark'; readonly path: readonly number[]; readonly bookmark: Bookmark }
  | { readonly type: 'edit-folder'; readonly path: readonly number[]; readonly folder: Folder }
  | { readonly type: 'move'; readonly path: readonly number[]; readonly node: BookmarkNode };

interface BookmarkTreeProps {
  readonly nodes: readonly BookmarkNode[];
  readonly depth?: number;
  readonly basePath?: readonly number[];
  readonly onAction?: (action: ItemAction) => void;
}

const EMPTY_PATH: readonly number[] = [];

export function BookmarkTree({
  nodes,
  depth = 0,
  basePath = EMPTY_PATH,
  onAction,
}: BookmarkTreeProps): React.JSX.Element {
  return (
    <Accordion type="multiple" className="w-full">
      {nodes.map((node, index) => {
        const path = [...basePath, index];
        if (isBookmark(node)) {
          return <BookmarkItem key={node.id} bookmark={node} path={path} onAction={onAction} />;
        }
        if (isFolder(node)) {
          return <FolderItem key={node.id} folder={node} depth={depth} path={path} onAction={onAction} />;
        }
        node satisfies never;
        throw new Error('Unexpected BookmarkNode type');
      })}
    </Accordion>
  );
}
