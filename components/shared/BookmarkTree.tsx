import { Accordion } from '@/components/ui/accordion';
import { BookmarkItem } from '@/components/shared/BookmarkItem';
import { FolderItem } from '@/components/shared/FolderItem';
import { isBookmark, isFolder } from '@/lib/data-model';
import type { BookmarkNode } from '@/lib/types';

interface BookmarkTreeProps {
  readonly nodes: readonly BookmarkNode[];
  readonly depth?: number;
}

export function BookmarkTree({
  nodes,
  depth = 0,
}: BookmarkTreeProps): React.JSX.Element {
  return (
    <Accordion type="multiple" className="w-full">
      {nodes.map((node) => {
        if (isBookmark(node)) {
          return <BookmarkItem key={node.id} bookmark={node} />;
        }
        if (isFolder(node)) {
          return <FolderItem key={node.id} folder={node} depth={depth} />;
        }
        return node satisfies never;
      })}
    </Accordion>
  );
}
