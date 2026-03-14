import { Button } from '@/components/ui/button';

export function EmptyTreeState(): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-50"
        aria-hidden="true"
      >
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
      </svg>
      <p className="text-sm">No bookmarks yet</p>
      <Button variant="outline" size="sm" disabled>
        Add Bookmark
      </Button>
    </div>
  );
}
