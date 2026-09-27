/** An error with an HTTP status, turned into `{ error }` JSON by the error handler in index.ts. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
