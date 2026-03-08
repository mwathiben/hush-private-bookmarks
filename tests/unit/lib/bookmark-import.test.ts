/*
 * Hush Private Bookmarks — Privacy-first browser extension for hidden bookmarks
 * Copyright (C) 2026 Hush Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Bookmark, BookmarkNode, Folder } from '@/lib/types';
import type { ChromeBookmarkTreeNode } from '@/lib/bookmark-import';
import { convertChromeBookmarks, parseHtmlBookmarks } from '@/lib/bookmark-import';
import { MAX_TREE_DEPTH } from '@/lib/data-model';
import { ImportError } from '@/lib/errors';

function collectIds(node: BookmarkNode): string[] {
  const ids = [node.id];
  if (node.type === 'folder') {
    for (const child of node.children) {
      ids.push(...collectIds(child));
    }
  }
  return ids;
}

function findFirstBookmark(node: BookmarkNode): Bookmark | undefined {
  if (node.type === 'bookmark') return node;
  for (const child of node.children) {
    const found = findFirstBookmark(child);
    if (found) return found;
  }
  return undefined;
}

function findFirstFolder(node: BookmarkNode): Folder | undefined {
  if (node.type === 'folder') {
    for (const child of node.children) {
      if (child.type === 'folder') return child;
      const found = findFirstFolder(child);
      if (found) return found;
    }
  }
  return undefined;
}

const SIMPLE_BOOKMARK: ChromeBookmarkTreeNode = {
  id: '10',
  title: 'Example',
  url: 'https://example.com',
  dateAdded: 1609459200000,
  parentId: '1',
};

const SIMPLE_FOLDER: ChromeBookmarkTreeNode = {
  id: '20',
  title: 'Dev Resources',
  parentId: '1',
  dateAdded: 1609459200000,
  children: [
    {
      id: '21',
      title: 'MDN',
      url: 'https://developer.mozilla.org',
      parentId: '20',
      dateAdded: 1609459200000,
    },
  ],
};

const CHROME_ROOT_TREE: ChromeBookmarkTreeNode[] = [
  {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        title: 'Bookmarks Bar',
        parentId: '0',
        children: [
          {
            id: '10',
            title: 'Google',
            url: 'https://google.com',
            parentId: '1',
            dateAdded: 1000,
          },
        ],
      },
      {
        id: '2',
        title: 'Other Bookmarks',
        parentId: '0',
        children: [
          {
            id: '20',
            title: 'GitHub',
            url: 'https://github.com',
            parentId: '2',
            dateAdded: 2000,
          },
        ],
      },
      {
        id: '3',
        title: 'Mobile Bookmarks',
        parentId: '0',
        children: [],
      },
    ],
  },
];

const NESTED_TREE: ChromeBookmarkTreeNode[] = [
  {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        title: 'Bookmarks Bar',
        parentId: '0',
        children: [
          {
            id: '100',
            title: 'Work',
            parentId: '1',
            dateAdded: 1000,
            children: [
              {
                id: '200',
                title: 'Projects',
                parentId: '100',
                dateAdded: 2000,
                children: [
                  {
                    id: '300',
                    title: 'Hush Repo',
                    url: 'https://github.com/example/hush',
                    parentId: '200',
                    dateAdded: 3000,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

describe('IMPORT-001: Convert Chrome bookmarks API tree', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('simple conversions', () => {
    it('converts simple Chrome bookmark to Hush Bookmark', () => {
      // #given
      const input: ChromeBookmarkTreeNode[] = [
        {
          id: '0',
          title: '',
          children: [
            { id: '1', title: 'Bar', parentId: '0', children: [SIMPLE_BOOKMARK] },
          ],
        },
      ];

      // #when
      const result = convertChromeBookmarks(input);

      // #then
      expect(result.success).toBe(true);
      if (!result.success) return;
      const bm = findFirstBookmark(result.data.tree);
      expect(bm).toBeDefined();
      expect(bm!.type).toBe('bookmark');
      expect(bm!.title).toBe('Example');
      expect(bm!.url).toBe('https://example.com');
      expect(bm!.dateAdded).toBe(1609459200000);
      expect(bm!.id).toBeTruthy();
    });

    it('converts Chrome folder to Hush Folder', () => {
      // #given
      const input: ChromeBookmarkTreeNode[] = [
        {
          id: '0',
          title: '',
          children: [
            { id: '1', title: 'Bar', parentId: '0', children: [SIMPLE_FOLDER] },
          ],
        },
      ];

      // #when
      const result = convertChromeBookmarks(input);

      // #then
      expect(result.success).toBe(true);
      if (!result.success) return;
      const folder = findFirstFolder(result.data.tree);
      expect(folder).toBeDefined();
      expect(folder!.type).toBe('folder');
      expect(folder!.name).toBe('Dev Resources');
      expect(folder!.children).toHaveLength(1);
      expect(folder!.id).toBeTruthy();
      expect(folder!.children[0]!.type).toBe('bookmark');
    });
  });

  describe('nested structures', () => {
    it('converts nested Chrome tree structure', () => {
      // #when
      const result = convertChromeBookmarks(NESTED_TREE);

      // #then
      expect(result.success).toBe(true);
      if (!result.success) return;
      const root = result.data.tree;
      expect(root.children).toHaveLength(1);

      const work = root.children[0]!;
      expect(work.type).toBe('folder');
      if (work.type !== 'folder') return;
      expect(work.name).toBe('Work');

      const projects = work.children[0]!;
      expect(projects.type).toBe('folder');
      if (projects.type !== 'folder') return;
      expect(projects.name).toBe('Projects');

      const bookmark = projects.children[0]!;
      expect(bookmark.type).toBe('bookmark');
      if (bookmark.type !== 'bookmark') return;
      expect(bookmark.title).toBe('Hush Repo');
      expect(bookmark.url).toBe('https://github.com/example/hush');
    });
  });

  describe('root container handling', () => {
    it('skips Chrome root containers and flattens children into Hush root', () => {
      // #when
      const result = convertChromeBookmarks(CHROME_ROOT_TREE);

      // #then
      expect(result.success).toBe(true);
      if (!result.success) return;
      const root = result.data.tree;
      expect(root.type).toBe('folder');
      expect(root.children).toHaveLength(2);

      const titles = root.children.map((c) =>
        c.type === 'bookmark' ? c.title : '',
      );
      expect(titles).toContain('Google');
      expect(titles).toContain('GitHub');
    });
  });

  describe('ID generation', () => {
    it('generates unique IDs for all imported items', () => {
      // #given — build a tree with 10 items
      const bookmarks: ChromeBookmarkTreeNode[] = Array.from(
        { length: 8 },
        (_, i) => ({
          id: `bm-${i}`,
          title: `Bookmark ${i}`,
          url: `https://example.com/${i}`,
          parentId: '1',
          dateAdded: 1000 + i,
        }),
      );
      const input: ChromeBookmarkTreeNode[] = [
        {
          id: '0',
          title: '',
          children: [
            {
              id: '1',
              title: 'Bar',
              parentId: '0',
              children: [
                {
                  id: 'f1',
                  title: 'Folder A',
                  parentId: '1',
                  dateAdded: 500,
                  children: bookmarks.slice(0, 4),
                },
                {
                  id: 'f2',
                  title: 'Folder B',
                  parentId: '1',
                  dateAdded: 600,
                  children: bookmarks.slice(4),
                },
              ],
            },
          ],
        },
      ];

      // #when
      const result = convertChromeBookmarks(input);

      // #then
      expect(result.success).toBe(true);
      if (!result.success) return;
      const ids = collectIds(result.data.tree);
      expect(ids.length).toBe(11);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
      for (const id of ids) {
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
      }

      const chromeIds = new Set([
        '0', '1', 'f1', 'f2',
        ...bookmarks.map((b) => b.id),
      ]);
      for (const id of ids) {
        expect(chromeIds.has(id)).toBe(false);
      }
    });
  });

  describe('graceful defaults', () => {
    it('handles missing dateAdded gracefully', () => {
      // #given
      vi.spyOn(Date, 'now').mockReturnValue(99999);
      const input: ChromeBookmarkTreeNode[] = [
        {
          id: '0',
          title: '',
          children: [
            {
              id: '1',
              title: 'Bar',
              parentId: '0',
              children: [
                { id: '10', title: 'No Date', url: 'https://nodate.com', parentId: '1' },
              ],
            },
          ],
        },
      ];

      // #when
      const result = convertChromeBookmarks(input);

      // #then
      expect(result.success).toBe(true);
      if (!result.success) return;
      const bm = findFirstBookmark(result.data.tree);
      expect(bm).toBeDefined();
      expect(bm!.dateAdded).toBe(99999);
    });

    it('handles node with empty title', () => {
      // #given
      const input: ChromeBookmarkTreeNode[] = [
        {
          id: '0',
          title: '',
          children: [
            {
              id: '1',
              title: 'Bar',
              parentId: '0',
              children: [
                { id: '10', title: '', url: 'https://untitled.com', parentId: '1', dateAdded: 1000 },
                {
                  id: '20',
                  title: '',
                  parentId: '1',
                  dateAdded: 2000,
                  children: [],
                },
              ],
            },
          ],
        },
      ];

      // #when
      const result = convertChromeBookmarks(input);

      // #then
      expect(result.success).toBe(true);
      if (!result.success) return;
      const bookmark = result.data.tree.children.find(
        (c) => c.type === 'bookmark',
      ) as Bookmark | undefined;
      expect(bookmark).toBeDefined();
      expect(bookmark!.title).toBe('Untitled');

      const folder = result.data.tree.children.find(
        (c) => c.type === 'folder',
      ) as Folder | undefined;
      expect(folder).toBeDefined();
      expect(folder!.name).toBe('Unnamed Folder');
    });
  });

  describe('error handling', () => {
    it('returns ImportError for null input', () => {
      // #when
      const result = convertChromeBookmarks(
        null as unknown as ChromeBookmarkTreeNode[],
      );

      // #then
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBeInstanceOf(ImportError);
      expect(result.error.context.source).toBe('chrome');
      expect(result.error.context.format).toBe('chrome-api');
    });
  });

  describe('statistics', () => {
    it('returns import statistics', () => {
      // #when
      const result = convertChromeBookmarks(CHROME_ROOT_TREE);

      // #then
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.stats.bookmarksImported).toBe(2);
      expect(result.data.stats.foldersImported).toBe(0);
      expect(result.data.stats.errors).toEqual([]);
    });
  });

  describe('depth truncation', () => {
    it('truncates children beyond MAX_TREE_DEPTH and reports in stats.errors', () => {
      // #given — build a chain of folders at MAX_TREE_DEPTH, with a child that should be truncated
      let deepNode: ChromeBookmarkTreeNode = {
        id: 'leaf',
        title: 'Leaf',
        url: 'https://example.com/leaf',
        parentId: 'deep',
        dateAdded: 9999,
      };
      for (let i = MAX_TREE_DEPTH; i >= 0; i--) {
        deepNode = {
          id: `depth-${i}`,
          title: `Depth ${i}`,
          parentId: i === 0 ? '1' : `depth-${i - 1}`,
          dateAdded: 1000 + i,
          children: [deepNode],
        };
      }
      const input: ChromeBookmarkTreeNode[] = [
        {
          id: '0',
          title: '',
          children: [
            { id: '1', title: 'Bar', parentId: '0', children: [deepNode] },
          ],
        },
      ];

      // #when
      const result = convertChromeBookmarks(input);

      // #then
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.stats.errors.length).toBeGreaterThan(0);
      expect(result.data.stats.errors[0]).toContain('truncated');
    });
  });

  describe('managed folder handling', () => {
    it('does not treat managed folders as root containers', () => {
      // #given — a managed folder nested inside a root container
      const input: ChromeBookmarkTreeNode[] = [
        {
          id: '0',
          title: '',
          children: [
            {
              id: '1',
              title: 'Bookmarks Bar',
              parentId: '0',
              children: [
                {
                  id: '100',
                  title: 'Managed Bookmarks',
                  parentId: '1',
                  folderType: 'managed',
                  dateAdded: 1000,
                  children: [
                    {
                      id: '200',
                      title: 'Corp Link',
                      url: 'https://corp.example.com',
                      parentId: '100',
                      dateAdded: 2000,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ];

      // #when
      const result = convertChromeBookmarks(input);

      // #then — managed folder should be preserved as a folder, not skipped
      expect(result.success).toBe(true);
      if (!result.success) return;
      const managed = result.data.tree.children[0];
      expect(managed).toBeDefined();
      expect(managed!.type).toBe('folder');
      if (managed!.type !== 'folder') return;
      expect(managed!.name).toBe('Managed Bookmarks');
      expect(managed!.children).toHaveLength(1);
      expect(result.data.stats.foldersImported).toBe(1);
    });
  });
});

const CHROME_HTML_EXPORT = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1609459200" LAST_MODIFIED="1609459200" PERSONAL_TOOLBAR_FOLDER="true">Dev</H3>
    <DL><p>
        <DT><A HREF="https://example.com" ADD_DATE="1609459200">Example</A>
        <DT><A HREF="https://github.com" ADD_DATE="1609459201">GitHub</A>
    </DL><p>
    <DT><A HREF="https://google.com" ADD_DATE="1609459202">Google</A>
</DL><p>`;

const FIREFOX_HTML_EXPORT = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks Menu</H1>
<DL><p>
    <DT><H3 ADD_DATE="1609459200" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks Toolbar</H3>
    <DL><p>
        <DT><A HREF="https://mozilla.org" ADD_DATE="1609459200" TAGS="browser,open-source">Mozilla</A>
    </DL><p>
    <DT><A HREF="https://firefox.com" ADD_DATE="1609459201">Firefox</A>
</DL><p>`;

const SPECIAL_CHARS_HTML = `<DL><p>
    <DT><A HREF="https://example.com/search?q=hello&amp;world" ADD_DATE="1609459200">Rock &amp; Roll ♪</A>
    <DT><A HREF="https://example.com/path?a=1&amp;b=2" ADD_DATE="1609459200">Quotes &quot;test&quot; &lt;html&gt;</A>
</DL><p>`;

describe('IMPORT-002: Parse HTML bookmark files', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Chrome HTML export', () => {
    it('parses Chrome HTML export with bookmarks and folders', () => {
      // #when
      const result = parseHtmlBookmarks(CHROME_HTML_EXPORT);

      // #then
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.stats.bookmarksImported).toBe(3);
      expect(result.data.stats.foldersImported).toBe(1);
      expect(result.data.tree.children.length).toBeGreaterThan(0);
    });

    it('extracts bookmark URL from HREF attribute', () => {
      // #when
      const result = parseHtmlBookmarks(CHROME_HTML_EXPORT);

      // #then
      expect(result.success).toBe(true);
      if (!result.success) return;
      const bm = findFirstBookmark(result.data.tree);
      expect(bm).toBeDefined();
      expect(bm!.url).toBe('https://example.com');
    });

    it('extracts bookmark title from anchor text', () => {
      // #when
      const result = parseHtmlBookmarks(CHROME_HTML_EXPORT);

      // #then
      expect(result.success).toBe(true);
      if (!result.success) return;
      const bm = findFirstBookmark(result.data.tree);
      expect(bm).toBeDefined();
      expect(bm!.title).toBe('Example');
    });

    it('converts ADD_DATE seconds to milliseconds', () => {
      // #given — ADD_DATE="1609459200" is seconds (Jan 1 2021 00:00:00 UTC)
      const html = `<DL><p><DT><A HREF="https://x.com" ADD_DATE="1609459200">X</A></DL><p>`;

      // #when
      const result = parseHtmlBookmarks(html);

      // #then
      expect(result.success).toBe(true);
      if (!result.success) return;
      const bm = findFirstBookmark(result.data.tree);
      expect(bm).toBeDefined();
      expect(bm!.dateAdded).toBe(1609459200000);
    });

    it('does not double-convert millisecond ADD_DATE', () => {
      // #given — ADD_DATE already in milliseconds (> 1e10 threshold)
      const html = `<DL><p><DT><A HREF="https://x.com" ADD_DATE="1609459200000">X</A></DL><p>`;

      // #when
      const result = parseHtmlBookmarks(html);

      // #then
      expect(result.success).toBe(true);
      if (!result.success) return;
      const bm = findFirstBookmark(result.data.tree);
      expect(bm).toBeDefined();
      expect(bm!.dateAdded).toBe(1609459200000);
    });
  });

  describe('folder hierarchy', () => {
    it('preserves folder hierarchy from DL/DT nesting', () => {
      // #when
      const result = parseHtmlBookmarks(CHROME_HTML_EXPORT);

      // #then
      expect(result.success).toBe(true);
      if (!result.success) return;
      const folder = findFirstFolder(result.data.tree);
      expect(folder).toBeDefined();
      expect(folder!.name).toBe('Dev');
      expect(folder!.children).toHaveLength(2);
      expect(folder!.children[0]!.type).toBe('bookmark');
    });
  });

  describe('Firefox HTML export', () => {
    it('handles Firefox HTML export', () => {
      // #when
      const result = parseHtmlBookmarks(FIREFOX_HTML_EXPORT);

      // #then
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.stats.bookmarksImported).toBe(2);
      expect(result.data.stats.foldersImported).toBe(1);
      const folder = findFirstFolder(result.data.tree);
      expect(folder).toBeDefined();
      expect(folder!.name).toBe('Bookmarks Toolbar');
    });
  });

  describe('edge cases', () => {
    it('returns empty tree for empty string', () => {
      // #when
      const result = parseHtmlBookmarks('');

      // #then
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.tree.children).toHaveLength(0);
      expect(result.data.stats.bookmarksImported).toBe(0);
      expect(result.data.stats.foldersImported).toBe(0);
    });

    it('returns ImportError for HTML with no DL structure', () => {
      // #given
      const html = '<html><body><p>Not a bookmark file</p></body></html>';

      // #when
      const result = parseHtmlBookmarks(html);

      // #then
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBeInstanceOf(ImportError);
      expect(result.error.context.source).toBe('html');
      expect(result.error.context.format).toBe('netscape-html');
    });

    it('handles bookmarks with special characters in title and URL', () => {
      // #when
      const result = parseHtmlBookmarks(SPECIAL_CHARS_HTML);

      // #then
      expect(result.success).toBe(true);
      if (!result.success) return;
      const bm = findFirstBookmark(result.data.tree);
      expect(bm).toBeDefined();
      expect(bm!.title).toBe('Rock & Roll ♪');
      expect(bm!.url).toBe('https://example.com/search?q=hello&world');
    });

    it('rejects HTML exceeding 5MB with ImportError', () => {
      // #given — string just over 5MB
      const html = 'x'.repeat(5 * 1024 * 1024 + 1);

      // #when
      const result = parseHtmlBookmarks(html);

      // #then
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBeInstanceOf(ImportError);
      expect(result.error.context.source).toBe('html');
      expect(result.error.context.format).toBe('netscape-html');
    });

    it('handles missing ADD_DATE — defaults to Date.now()', () => {
      // #given
      vi.spyOn(Date, 'now').mockReturnValue(99999);
      const html = `<DL><p><DT><A HREF="https://x.com">No Date</A></DL><p>`;

      // #when
      const result = parseHtmlBookmarks(html);

      // #then
      expect(result.success).toBe(true);
      if (!result.success) return;
      const bm = findFirstBookmark(result.data.tree);
      expect(bm).toBeDefined();
      expect(bm!.dateAdded).toBe(99999);
    });

    it('handles bookmark with empty title — falls back to Untitled', () => {
      // #given
      const html = `<DL><p><DT><A HREF="https://x.com" ADD_DATE="1000"></A></DL><p>`;

      // #when
      const result = parseHtmlBookmarks(html);

      // #then
      expect(result.success).toBe(true);
      if (!result.success) return;
      const bm = findFirstBookmark(result.data.tree);
      expect(bm).toBeDefined();
      expect(bm!.title).toBe('Untitled');
    });

    it('handles folder with empty name — falls back to Unnamed Folder', () => {
      // #given
      const html = `<DL><p>
        <DT><H3 ADD_DATE="1000"></H3>
        <DL><p><DT><A HREF="https://x.com" ADD_DATE="1000">X</A></DL><p>
      </DL><p>`;

      // #when
      const result = parseHtmlBookmarks(html);

      // #then
      expect(result.success).toBe(true);
      if (!result.success) return;
      const folder = findFirstFolder(result.data.tree);
      expect(folder).toBeDefined();
      expect(folder!.name).toBe('Unnamed Folder');
    });

    it('truncates children beyond MAX_TREE_DEPTH and records error', () => {
      // #given — build nested DL/DT structure exceeding MAX_TREE_DEPTH
      let html = '';
      for (let i = 0; i <= MAX_TREE_DEPTH; i++) {
        html += `<DL><p><DT><H3 ADD_DATE="1000">F${i}</H3>`;
      }
      html += `<DL><p><DT><A HREF="https://deep.com" ADD_DATE="1000">Deep</A></DL><p>`;
      for (let i = 0; i <= MAX_TREE_DEPTH; i++) {
        html += `</DL><p>`;
      }

      // #when
      const result = parseHtmlBookmarks(html);

      // #then
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.stats.errors.length).toBeGreaterThan(0);
      expect(result.data.stats.errors[0]).toMatch(/children truncated/);
    });
  });

  describe('ID generation', () => {
    it('generates unique IDs for all imported items', () => {
      // #when
      const result = parseHtmlBookmarks(CHROME_HTML_EXPORT);

      // #then
      expect(result.success).toBe(true);
      if (!result.success) return;
      const ids = collectIds(result.data.tree);
      expect(ids.length).toBe(5);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
      for (const id of ids) {
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
      }
    });
  });

  describe('statistics', () => {
    it('returns correct bookmark and folder counts', () => {
      // #when
      const result = parseHtmlBookmarks(CHROME_HTML_EXPORT);

      // #then
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.stats.bookmarksImported).toBe(3);
      expect(result.data.stats.foldersImported).toBe(1);
      expect(result.data.stats.errors).toEqual([]);
    });
  });
});
