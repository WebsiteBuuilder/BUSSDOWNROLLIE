type Release = () => void;

type LockQueueItem = {
  resolve: (release: Release) => void;
};

class Mutex {
  private queue: LockQueueItem[] = [];
  private locked = false;

  async acquire(): Promise<Release> {
    if (!this.locked) {
      this.locked = true;
      return () => this.release();
    }

    return new Promise<Release>((resolve) => {
      this.queue.push({
        resolve: () => {
          this.locked = true;
          resolve(() => this.release());
        },
      });
    });
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) {
      next.resolve(() => this.release());
    } else {
      this.locked = false;
    }
  }
}

export class GiveawayLockManager {
  private locks = new Map<string, Mutex>();

  private getLock(id: string): Mutex {
    let lock = this.locks.get(id);
    if (!lock) {
      lock = new Mutex();
      this.locks.set(id, lock);
    }
    return lock;
  }

  async withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const release = await this.getLock(id).acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }
}
