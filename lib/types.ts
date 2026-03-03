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
 * Holy PB uses number[] for salt/iv/data. Hush uses base64 strings (more compact in JSON).
 * Hush extension: iterations (Holy PB hardcodes 600k, Hush stores for future-proofing).
 */
export interface EncryptedStore {
  readonly salt: string;
  readonly encrypted: string;
  readonly iv: string;
  readonly iterations: number;
}

/** Named encrypted collection. Entirely new to Hush (Holy PB is single password/blob). */
export interface PasswordSet {
  readonly id: string;
  readonly name: string;
  readonly store: EncryptedStore;
  readonly createdAt: number;
}

/** BIP-39 mnemonic recovery data. Entirely new to Hush (Holy PB has no recovery). */
export interface RecoveryPhrase {
  readonly words: readonly string[];
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

/** Type-safe success/failure wrapper. Discriminated on the `success` field. */
export type Result<T, E = Error> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };
