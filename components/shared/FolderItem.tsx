import { memo } from 'react';
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { BookmarkTree } from '@/components/shared/BookmarkTree';
import type { Folder } from '@/lib/types';

interface FolderItemProps {
  readonly folder: Folder;
  readonly depth: number;
}

export const FolderItem = memo(function FolderItem({
  folder,
  depth,
}: FolderItemProps): React.JSX.Element {
  return (
    <AccordionItem value={folder.id}>
      <AccordionTrigger className="py-1.5 px-2">
        <span className="flex items-center gap-2 truncate">
          <span className="truncate">{folder.name}</span>
          <Badge variant="secondary" className="text-xs">
            {folder.children.length}
          </Badge>
        </span>
      </AccordionTrigger>
      <AccordionContent className="pl-3">
        <BookmarkTree nodes={folder.children} depth={depth + 1} />
      </AccordionContent>
    </AccordionItem>
  );
});
