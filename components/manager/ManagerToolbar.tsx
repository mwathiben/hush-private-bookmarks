import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ManagerToolbarProps {
  readonly searchQuery: string;
  readonly onSearchChange: (query: string) => void;
  readonly onAddBookmark: () => void;
  readonly onAddFolder: () => void;
  readonly disabled: boolean;
}

export function ManagerToolbar({
  searchQuery,
  onSearchChange,
  onAddBookmark,
  onAddFolder,
  disabled,
}: ManagerToolbarProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 border-b px-4 py-2" role="toolbar" aria-label="Bookmark actions">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search bookmarks..."
          aria-label="Search bookmarks"
          value={searchQuery}
          onChange={(e) => { onSearchChange(e.target.value); }}
          disabled={disabled}
          className="pl-9"
        />
      </div>
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={onAddBookmark}
      >
        + Bookmark
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={onAddFolder}
      >
        + Folder
      </Button>
    </div>
  );
}
