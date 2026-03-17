/** A single saved bookmark. Holy PB: type, title, url, dateAdded. Hush extension: id. */
export interface Bookmark {
  readonly type: 'bookmark';
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly dateAdded: number;
}

/**
 * A folder containing bookmarks or other folders.
 * Holy PB: type, name, children, dateAdded. Hush extension: id.
 */
export interface Folder {
  readonly type: 'folder';
  readonly id: string;
  readonly name: string;
  readonly children: readonly BookmarkNode[];
  readonly dateAdded: number;
}

/** Discriminated union of Bookmark | Folder, narrowed via the `type` field. */
export type BookmarkNode = Bookmark | Folder;

/** The root folder of the bookmark tree. Alias for Folder. */
export type BookmarkTree = Folder;

/**
 * AES-256-GCM encrypted payload with PBKDF2 key derivation parameters.
 *
 * Holy PB format: `{ iv: number[], data: number[] }` with salt stored separately.
 * Hush format: base64-encoded strings with bundled salt and iteration count.
 * Migration from Holy PB format to Hush EncryptedStore is Module 14's responsibility.
 *
 * - salt: 16-byte CSPRNG output, base64-encoded (RFC 4648 standard alphabet)
 * - iv: 12-byte CSPRNG initialization vector, base64-encoded
 * - encrypted: AES-256-GCM ciphertext + 16-byte auth tag, base64-encoded
 * - iterations: PBKDF2 iteration count (600,000 per OWASP 2025)
 */
export interface EncryptedStore {
  readonly salt: string;
  readonly encrypted: string;
  readonly iv: string;
  readonly iterations: number;
}

/** Metadata for one password set. Stored in the manifest, never encrypted. */
export interface PasswordSetInfo {
  readonly id: string;
  readonly name: string;
  readonly createdAt: number;
  readonly lastAccessedAt: number;
  readonly isDefault: boolean;
}

/** Tracks which password sets exist and which is active. Stored unencrypted. */
export interface PasswordSetManifest {
  readonly sets: readonly PasswordSetInfo[];
  readonly activeSetId: string;
  readonly version: number;
}

/**
 * Proof that BIP-39 recovery was configured for a password set.
 * The mnemonic phrase itself is NEVER stored — the user writes it down physically.
 * Only derivedKeyHash is persisted as a checksum proving recovery was set up.
 */
export interface RecoveryMetadata {
  readonly derivedKeyHash: string;
}

/** Crypto algorithm parameters. Hush uses AES-256-GCM + PBKDF2 >= 600k iterations. */
export interface CryptoConfig {
  readonly iterations: number;
  readonly algorithm: string;
  readonly keyLength: number;
  readonly ivLength: number;
  readonly hashAlgorithm: string;
}

/** Pro subscription status. Maps from ExtensionPay User to app-level gating. */
export interface ProStatus {
  readonly isPro: boolean;
  readonly expiresAt: number | null;
  readonly trialDaysLeft: number | null;
  readonly canTrial: boolean;
}

/** Type-safe success/failure wrapper. Discriminated on the `success` field. */
export type Result<T, E = Error> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };
