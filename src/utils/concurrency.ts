/**
 * Runs `operation` over `items` with at most `limit` calls in flight, keeping
 * results in the order the items arrived. The pool is local to this process: it
 * bounds how much work one task dispatches, not how much reaches the provider.
 *
 * Operations are expected to handle their own failures; a rejected operation
 * rejects the whole call, exactly as a sequential loop would.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  operation: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  if (!items.length) return results;

  const configured = Number.isFinite(limit) ? Math.floor(limit) : 1;
  const workers = Math.min(Math.max(configured, 1), items.length);
  let next = 0;

  const run = async (): Promise<void> => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await operation(items[index]!, index);
    }
  };

  await Promise.all(Array.from({ length: workers }, run));
  return results;
}
