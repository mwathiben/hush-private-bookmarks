// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSearch } from '@/hooks/useSearch';
import type { BookmarkTree } from '@/lib/types';

const MOCK_TREE: BookmarkTree = {
  type: 'folder',
  id: 'root',
  name: 'Root',
  dateAdded: 0,
  children: [
    {
      type: 'folder',
      id: 'f-1',
      name: 'Work',
      dateAdded: 100,
      children: [
        { type: 'bookmark', id: 'bm-nested', title: 'Jira Board', url: 'https://jira.example.com', dateAdded: 200 },
      ],
    },
    { type: 'bookmark', id: 'bm-1', title: 'GitHub', url: 'https://github.com', dateAdded: 300 },
    { type: 'bookmark', id: 'bm-2', title: 'Example Site', url: 'https://example.com', dateAdded: 400 },
  ],
};

describe('useSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty array when tree is null', () => {
    // #given
    const { result } = renderHook(() => useSearch(null, 'test'));

    // #when
    act(() => { vi.advanceTimersByTime(200); });

    // #then
    expect(result.current.results).toEqual([]);
  });

  it('returns empty array when query is empty string', () => {
    // #given
    const { result } = renderHook(() => useSearch(MOCK_TREE, ''));

    // #when
    act(() => { vi.advanceTimersByTime(200); });

    // #then
    expect(result.current.results).toEqual([]);
  });

  it('filters bookmarks by title (case-insensitive)', () => {
    // #given
    const { result } = renderHook(() => useSearch(MOCK_TREE, 'github'));

    // #when
    act(() => { vi.advanceTimersByTime(200); });

    // #then
    expect(result.current.results).toHaveLength(1);
    expect(result.current.results[0]!.title).toBe('GitHub');
  });

  it('filters bookmarks by URL (case-insensitive)', () => {
    // #given
    const { result } = renderHook(() => useSearch(MOCK_TREE, 'GITHUB.COM'));

    // #when
    act(() => { vi.advanceTimersByTime(200); });

    // #then
    expect(result.current.results).toHaveLength(1);
    expect(result.current.results[0]!.title).toBe('GitHub');
  });

  it('excludes folders from results', () => {
    // #given — "Work" is a folder name
    const { result } = renderHook(() => useSearch(MOCK_TREE, 'Work'));

    // #when
    act(() => { vi.advanceTimersByTime(200); });

    // #then
    expect(result.current.results).toEqual([]);
  });

  it('debounces query changes by 200ms', () => {
    // #given
    const { result, rerender } = renderHook(
      ({ query }) => useSearch(MOCK_TREE, query),
      { initialProps: { query: '' } },
    );

    // #when — type a query but don't wait for debounce
    rerender({ query: 'git' });
    expect(result.current.results).toEqual([]);

    // #then — after 200ms, results appear
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.results).toHaveLength(1);
  });

  it('returns isSearching=true while debounce pending', () => {
    // #given
    const { result, rerender } = renderHook(
      ({ query }) => useSearch(MOCK_TREE, query),
      { initialProps: { query: '' } },
    );

    // #when
    rerender({ query: 'github' });

    // #then
    expect(result.current.isSearching).toBe(true);
  });

  it('returns isSearching=false after debounce settles', () => {
    // #given
    const { result, rerender } = renderHook(
      ({ query }) => useSearch(MOCK_TREE, query),
      { initialProps: { query: '' } },
    );

    // #when
    rerender({ query: 'github' });
    act(() => { vi.advanceTimersByTime(200); });

    // #then
    expect(result.current.isSearching).toBe(false);
  });

  it('cleans up timer on unmount', () => {
    // #given
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { unmount, rerender } = renderHook(
      ({ query }) => useSearch(MOCK_TREE, query),
      { initialProps: { query: '' } },
    );

    // #when — trigger a debounce timer then unmount
    rerender({ query: 'test' });
    unmount();

    // #then
    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('searches nested bookmarks inside folders', () => {
    // #given — Jira Board is inside Work folder
    const { result } = renderHook(() => useSearch(MOCK_TREE, 'jira'));

    // #when
    act(() => { vi.advanceTimersByTime(200); });

    // #then
    expect(result.current.results).toHaveLength(1);
    expect(result.current.results[0]!.title).toBe('Jira Board');
  });

  it('returns empty when query matches nothing', () => {
    // #given
    const { result } = renderHook(() => useSearch(MOCK_TREE, 'nonexistent'));

    // #when
    act(() => { vi.advanceTimersByTime(200); });

    // #then
    expect(result.current.results).toEqual([]);
  });

  it('accepts custom delay parameter', () => {
    // #given
    const { result } = renderHook(() => useSearch(MOCK_TREE, 'github', 500));

    // #when — 200ms: not yet
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.results).toEqual([]);

    // #then — 500ms: debounce fires
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current.results).toHaveLength(1);
  });
});
