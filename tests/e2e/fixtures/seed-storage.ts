export const SEED_PASSWORD = 'testpass123';

export const POPULATED_TREE = JSON.stringify({
  type: 'folder',
  id: 'root',
  name: 'Root',
  children: [
    {
      type: 'bookmark',
      id: 'b1',
      title: 'GitHub',
      url: 'https://github.com',
      dateAdded: 0,
    },
    {
      type: 'folder',
      id: 'f1',
      name: 'Work',
      children: [
        {
          type: 'bookmark',
          id: 'b2',
          title: 'Jira',
          url: 'https://jira.example.com',
          dateAdded: 0,
        },
      ],
      dateAdded: 0,
    },
  ],
  dateAdded: 0,
});

export function seedStorage(): (
  args: readonly [string, string],
) => Promise<void> {
  return async ([password, tree]: readonly [string, string]) => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 600_000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt'],
    );
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      key,
      encoder.encode(tree),
    );

    function toBase64(bytes: Uint8Array): string {
      let binary = '';
      for (let i = 0; i < bytes.length; i++)
        binary += String.fromCharCode(bytes[i]!);
      return btoa(binary);
    }

    const store = {
      salt: toBase64(salt),
      iv: toBase64(iv),
      encrypted: toBase64(new Uint8Array(encrypted)),
      iterations: 600_000,
    };

    const setId = 'default';
    const manifest = {
      version: 1,
      activeSetId: setId,
      sets: [
        {
          id: setId,
          name: 'Default',
          createdAt: Date.now(),
          lastAccessedAt: Date.now(),
          isDefault: true,
        },
      ],
    };

    await chrome.storage.local.set({
      hush_manifest: manifest,
      holyPrivateData: store,
    });
  };
}
