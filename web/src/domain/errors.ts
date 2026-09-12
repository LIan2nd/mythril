export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid request') {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409, 'CONFLICT');
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHENTICATED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'FORBIDDEN');
  }
}
