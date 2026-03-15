import { useState, useCallback } from 'react';
import { Lock, ChevronRight, ChevronDown, FolderIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetPicker } from '@/components/ui/SetPicker';
import { isFolder } from '@/lib/data-model';
import type { BookmarkTree } from '@/lib/types';
import type { SessionState } from '@/lib/background-types';

interface ManagerSidebarProps {
  readonly tree: BookmarkTree | null;
  readonly session: SessionState | null;
  readonly selectedPath: readonly number[] | null;
  readonly onSelectFolder: (path: readonly number[] | null) => void;
  readonly onLock: () => void;
}

interface FolderNavItemProps {
  readonly name: string;
  readonly path: readonly number[];
  readonly children: BookmarkTree['children'];
  readonly depth: number;
  readonly selectedPath: readonly number[] | null;
  readonly onSelectFolder: (path: readonly number[]) => void;
}

function pathsEqual(a: readonly number[] | null, b: readonly number[]): boolean {
  if (a === null) return false;
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function FolderNavItem({ name, path, children, depth, selectedPath, onSelectFolder }: FolderNavItemProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(depth === 0);
  const isSelected = pathsEqual(selectedPath, path);
  const hasSubfolders = children.some(isFolder);

  const toggle = useCallback(() => setExpanded((e) => !e), []);

  return (
    <div>
      <div className="flex items-center">
        {hasSubfolders ? (
          <button
            type="button"
            aria-label="Toggle folder"
            aria-expanded={expanded}
            className="shrink-0 rounded-md p-1 hover:bg-sidebar-accent/50"
            style={{ marginLeft: `${depth * 16 + 8}px` }}
            onClick={(e) => {
              e.stopPropagation();
              toggle();
            }}
          >
            {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
        ) : (
          <span className="w-5 shrink-0" style={{ marginLeft: `${depth * 16 + 8}px` }} />
        )}
        <button
          type="button"
          className={`flex min-w-0 flex-1 items-center gap-1 rounded-md px-2 py-1 text-sm ${
            isSelected ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'hover:bg-sidebar-accent/50'
          }`}
          onClick={() => onSelectFolder(path)}
        >
          <FolderIcon className="size-3.5 shrink-0" />
          <span className="truncate">{name}</span>
        </button>
      </div>
      {expanded && children.map((child, i) => isFolder(child) ? (
        <FolderNavItem
          key={child.id}
          name={child.name}
          path={[...path, i]}
          children={child.children}
          depth={depth + 1}
          selectedPath={selectedPath}
          onSelectFolder={onSelectFolder}
        />
      ) : null)}
    </div>
  );
}

export function ManagerSidebar({
  tree,
  session,
  selectedPath,
  onSelectFolder,
  onLock,
}: ManagerSidebarProps): React.JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h1 className="text-sm font-semibold">Hush Bookmarks</h1>
        <Button variant="ghost" size="icon-xs" aria-label="Lock" onClick={onLock}>
          <Lock className="size-4" />
        </Button>
      </div>
      <nav className="flex-1 overflow-y-auto p-2" aria-label="Folder navigation">
        <button
          type="button"
          className={`flex w-full items-center gap-1 rounded-md px-2 py-1 text-sm ${
            selectedPath === null ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'hover:bg-sidebar-accent/50'
          }`}
          onClick={() => onSelectFolder(null)}
        >
          <FolderIcon className="size-3.5 shrink-0" />
          <span>All Bookmarks</span>
        </button>
        {tree !== null && tree.children.map((child, i) => isFolder(child) ? (
          <FolderNavItem
            key={child.id}
            name={child.name}
            path={[i]}
            children={child.children}
            depth={0}
            selectedPath={selectedPath}
            onSelectFolder={onSelectFolder}
          />
        ) : null)}
      </nav>
      {session !== null && session.sets.length > 1 && (
        <div className="border-t p-3">
          <SetPicker
            sets={session.sets}
            value={session.activeSetId}
            onChange={() => {}}
            disabled
          />
        </div>
      )}
    </div>
  );
}
