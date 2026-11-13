import type { ErrorRequestHandler } from 'express';

// An error with an HTTP status and a message that is safe to show to the user.
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ message: error.message });
    return;
  }
  // Body too large or invalid JSON (thrown by express.json)
  if (typeof error?.status === 'number' && error.status >= 400 && error.status < 500) {
    const message = error.type === 'entity.too.large' ? 'That image is too large' : 'Invalid request';
    res.status(error.status).json({ message });
    return;
  }
  console.error(error);
  res.status(500).json({ message: 'Something went wrong on the server' });
};
