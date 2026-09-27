// Runs jobs one at a time per key (e.g. per profile), so two quick POSTs can't overwrite each other's mastery.
const chains = new Map<string, Promise<unknown>>();

export function runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(key) ?? Promise.resolve();
  const job = prev.then(fn, fn);
  // The tail swallows this job's failure (the caller gets it from `job`) so no derived promise rejects unhandled.
  const tail = job.then(
    () => undefined,
    () => undefined,
  );
  chains.set(key, tail);
  void tail.then(() => {
    if (chains.get(key) === tail) chains.delete(key);
  });
  return job;
}

export const pendingKeys = () => chains.size;
