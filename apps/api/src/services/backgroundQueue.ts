type Task = () => Promise<void>;

const queues = new Map<string, Promise<void>>();

export const enqueueTask = (key: string, task: Task) => {
  const previous = queues.get(key) ?? Promise.resolve();

  const next = previous
    .catch(() => {
      // Swallow previous errors so the chain continues.
    })
    .then(task)
    .catch(error => {
      console.error(`[queue:${key}] task failed:`, error);
    })
    .finally(() => {
      if (queues.get(key) === next) queues.delete(key);
    });

  queues.set(key, next);
};
