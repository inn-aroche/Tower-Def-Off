/** Generic object pool — avoids `new` allocations in hot loops (projectiles, enemies, particles). */
export class ObjectPool<T> {
  private free: T[] = [];
  private active = new Set<T>();

  constructor(private readonly factory: () => T, private readonly reset: (item: T) => void, preallocate = 0) {
    for (let i = 0; i < preallocate; i++) this.free.push(this.factory());
  }

  acquire(): T {
    const item = this.free.pop() ?? this.factory();
    this.active.add(item);
    return item;
  }

  release(item: T): void {
    if (!this.active.delete(item)) return;
    this.reset(item);
    this.free.push(item);
  }

  releaseAll(): void {
    for (const item of this.active) {
      this.reset(item);
      this.free.push(item);
    }
    this.active.clear();
  }

  get activeItems(): ReadonlySet<T> {
    return this.active;
  }

  get activeCount(): number {
    return this.active.size;
  }
}
