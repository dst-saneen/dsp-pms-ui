export abstract class WorkflowRuntimeError extends Error {
  protected constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);

    this.name = new.target.name;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}
