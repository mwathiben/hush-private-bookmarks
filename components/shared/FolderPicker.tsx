import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { isFolder } from '@/lib/data-model';
import type { BookmarkTree, BookmarkNode } from '@/lib/types';

interface PickableFolder {
  readonly name: string;
  readonly path: readonly number[];
  readonly depth: number;
  readonly childrenCount: number;
}

function isDescendantOrSelf(
  path: readonly number[],
  excludePath: readonly number[],
): boolean {
  if (path.length < excludePath.length) return false;
  return excludePath.every((v, i) => path[i] === v);
}

export function collectPickableFolders(
  tree: BookmarkTree,
  excludePath: readonly number[],
): PickableFolder[] {
  const result: PickableFolder[] = [];

  function walk(nodes: readonly BookmarkNode[], basePath: readonly number[], depth: number): void {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]!;
      if (!isFolder(node)) continue;
      const path = [...basePath, i];
      if (isDescendantOrSelf(path, excludePath)) continue;
      result.push({ name: node.name, path, depth, childrenCount: node.children.length });
      walk(node.children, path, depth + 1);
    }
  }

  if (!isDescendantOrSelf([], excludePath)) {
    result.push({ name: tree.name, path: [], depth: 0, childrenCount: tree.children.length });
  }
  walk(tree.children, [], 1);
  return result;
}

export interface FolderPickerProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly tree: BookmarkTree;
  readonly excludePath: readonly number[];
  readonly onSelect: (folderPath: readonly number[], childrenCount: number) => void;
}

export function FolderPicker({
  open,
  onOpenChange,
  tree,
  excludePath,
  onSelect,
}: FolderPickerProps): React.JSX.Element {
  const folders = useMemo(
    () => collectPickableFolders(tree, excludePath),
    [tree, excludePath],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Move to folder</DialogTitle>
          <DialogDescription>Select a destination folder.</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-60 flex-col gap-1 overflow-y-auto py-2">
          {folders.map((folder) => (
            <Button
              key={folder.path.join(',')}
              variant="ghost"
              className="justify-start"
              style={{ paddingLeft: `${folder.depth * 16 + 8}px` }}
              onClick={() => onSelect([...folder.path], folder.childrenCount)}
            >
              {folder.name}
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
