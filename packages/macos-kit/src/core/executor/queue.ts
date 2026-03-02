export class SerialTaskQueue {
  private tail: Promise<void> = Promise.resolve()

  async run<T>(task: () => Promise<T>): Promise<T> {
    const runPromise = this.tail.then(task, task)
    this.tail = runPromise.then(
      () => undefined,
      () => undefined
    )
    return runPromise
  }
}
