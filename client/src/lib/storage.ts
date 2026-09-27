// Native counterpart of storage.web.ts: in-memory for now (persisting identity natively is out of demo scope).
const memory = new Map<string, string>();

export const storage = {
  get(key: string): string | null {
    return memory.get(key) ?? null;
  },
  set(key: string, value: string | null): void {
    if (value === null) memory.delete(key);
    else memory.set(key, value);
  },
};
