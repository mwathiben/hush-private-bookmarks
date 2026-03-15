import { memo } from 'react';
import { MoreHorizontal } from 'lucide-react';
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BookmarkTree } from '@/components/shared/BookmarkTree';
import type { Folder } from '@/lib/types';
import type { ItemAction } from '@/components/shared/BookmarkTree';

interface FolderItemProps {
  readonly folder: Folder;
  readonly depth: number;
  readonly path?: readonly number[];
  readonly onAction?: (action: ItemAction) => void;
}

export const FolderItem = memo(function FolderItem({
  folder,
  depth,
  path,
  onAction,
}: FolderItemProps): React.JSX.Element {
  return (
    <AccordionItem value={folder.id}>
      <div className="group flex items-center">
        <AccordionTrigger className="min-w-0 flex-1 py-1.5 px-2">
          <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
            <span className="truncate">{folder.name}</span>
            <Badge variant="secondary" className="text-xs">
              {folder.children.length}
            </Badge>
          </span>
        </AccordionTrigger>
        {onAction && path && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="size-8 shrink-0 p-0 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                aria-label="Folder actions"
              >
                <MoreHorizontal />
                <span className="sr-only">Folder actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={() => onAction({ type: 'edit-folder', path: [...path], folder })}>
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onAction({ type: 'move', path: [...path], node: folder })}>
                  Move to...
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => onAction({ type: 'delete', path: [...path], node: folder })}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <AccordionContent className="pl-3">
        <BookmarkTree nodes={folder.children} depth={depth + 1} basePath={path} onAction={onAction} />
      </AccordionContent>
    </AccordionItem>
  );
});
