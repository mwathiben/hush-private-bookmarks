import { useState, useEffect, useMemo } from 'react';
import { flattenTree, isBookmark } from '@/lib/data-model';
import type { Bookmark, BookmarkTree } from '@/lib/types';

const DEFAULT_DELAY = 200;

interface UseSearchReturn {
  readonly results: readonly Bookmark[];
  readonly isSearching: boolean;
}

export function useSearch(
  tree: BookmarkTree | null,
  query: string,
  delay: number = DEFAULT_DELAY,
): UseSearchReturn {
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, delay);
    return () => { clearTimeout(timer); };
  }, [query, delay]);

  const results = useMemo<readonly Bookmark[]>(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (tree === null || q === '') return [];
    return flattenTree(tree)
      .filter(isBookmark)
      .filter((b) => b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q));
  }, [tree, debouncedQuery]);

  const isSearching = query !== '' && query !== debouncedQuery;

  return { results, isSearching };
}
