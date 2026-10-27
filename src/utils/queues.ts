/**
 * Serializes asynchronous work per key inside one process. The lock is local to
 * this process: a second CLI or server process does not coordinate through it.
 * A rejected operation leaves the queue usable for later callers.
 */
export class KeyedQueue {
  readonly #tails = new Map<string, Promise<void>>();

  run<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.#tails.get(key) ?? Promise.resolve();
    // `previous` never rejects, so one failed operation cannot block the next.
    const result = previous.then(operation);
    const tail = result.then(() => undefined, () => undefined);
    this.#tails.set(key, tail);
    void tail.then(() => {
      if (this.#tails.get(key) === tail) this.#tails.delete(key);
    });
    return result;
  }
}
