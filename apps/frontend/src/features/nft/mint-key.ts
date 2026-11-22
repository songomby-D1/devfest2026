// One idempotency key per user intent to certify an item. It lives in
// sessionStorage, keyed by ContentId, so a reload or a retry after a network
// error resends the same key and the NFT service never mints twice. It is not
// a credential: it only names one mint request of the signed-in user.
// The key is dropped once the mint reaches a final state (confirmed or failed),
// so a new attempt after a failure is a new intent with a new key.

const PREFIX = 'lova:mint-key:';
/** Matches the gateway rule `^[A-Za-z0-9_-]{16,128}$`. */
const KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

type KeyStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function sessionStore(): KeyStorage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** 41 characters, inside the 16 to 128 allowed by the gateway. */
export function newMintKey(): string {
  return `mint-${crypto.randomUUID()}`;
}

/** Fallback when sessionStorage is unavailable, so retries in this page still reuse a key. */
const memory = new Map<string, string>();

function read(storage: KeyStorage | null, name: string): string | null {
  if (storage === null) return memory.get(name) ?? null;
  try {
    return storage.getItem(name);
  } catch {
    return memory.get(name) ?? null;
  }
}

function write(storage: KeyStorage | null, name: string, key: string): void {
  try {
    if (storage === null) throw new Error('no storage');
    storage.setItem(name, key);
  } catch {
    memory.set(name, key);
  }
}

export function getOrCreateMintKey(
  contentId: string,
  storage: KeyStorage | null = sessionStore(),
  create: () => string = newMintKey,
): string {
  const name = PREFIX + contentId;
  const stored = read(storage, name);
  if (stored !== null && KEY_PATTERN.test(stored)) return stored;
  const key = create();
  write(storage, name, key);
  return key;
}

export function clearMintKey(
  contentId: string,
  storage: KeyStorage | null = sessionStore(),
): void {
  const name = PREFIX + contentId;
  memory.delete(name);
  try {
    storage?.removeItem(name);
  } catch {
    // Nothing else to clean up.
  }
}
