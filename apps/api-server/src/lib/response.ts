import type { Response } from "express";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
}

const DEFAULT_EN: Record<number, string> = {
  400: "Bad request.",
  401: "Authentication required.",
  403: "Access denied.",
  404: "Resource not found.",
  429: "Too many requests. Please slow down.",
  500: "An unexpected error occurred. Please try again later.",
  502: "Service unavailable.",
  503: "Service unavailable.",
};

export function sendSuccess(
  res: Response,
  data?: unknown,
  message?: string,
  statusCode?: number
): void {
  const code = statusCode ?? 200;
  const body: ApiResponse = { success: true };
  if (data !== undefined) body.data = data;
  if (message) body.message = message;
  res.status(code).json(body);
}

export function sendCreated<T>(res: Response, data: T, message?: string): void {
  sendSuccess(res, data, message, 201);
}

export function sendAccepted<T>(res: Response, data: T, message?: string): void {
  sendSuccess(res, data, message, 202);
}

export function sendError(
  res: Response,
  error: string,
  statusCode?: number,
  message?: string
): void {
  const code = statusCode ?? 500;
  const body: ApiResponse = { success: false, error };
  body.message = message || DEFAULT_EN[code] || DEFAULT_EN[500]!;
  res.status(code).json(body);
}

export function sendErrorWithData<T>(
  res: Response,
  error: string,
  data: T,
  statusCode?: number,
  message?: string
): void {
  const code = statusCode ?? 500;
  const body: ApiResponse<T> = { success: false, error, data };
  body.message = message || DEFAULT_EN[code] || DEFAULT_EN[500]!;
  res.status(code).json(body);
}

export function sendValidationError(res: Response, error: string, message?: string): void {
  sendError(res, error, 400, message || "Validation error. Please check your input.");
}

export function sendUnauthorized(
  res: Response,
  error = "Authentication required.",
  message?: string
): void {
  sendError(res, error, 401, message);
}

export function sendForbidden(res: Response, error = "Access denied.", message?: string): void {
  sendError(res, error, 403, message);
}

export function sendNotFound(res: Response, error = "Resource not found.", message?: string): void {
  sendError(res, error, 404, message);
}

export function sendTooManyRequests(res: Response, retryAfterOrMessage?: number | string): void {
  let message = "Too many requests. Please slow down.";
  if (typeof retryAfterOrMessage === "number") {
    res.setHeader("Retry-After", retryAfterOrMessage.toString());
  } else if (typeof retryAfterOrMessage === "string") {
    message = retryAfterOrMessage;
  }
  sendError(res, message, 429);
}

export function sendConflict(res: Response, error = "Conflict.", message?: string): void {
  sendError(res, error, 409, message);
}

export function sendInternalError(res: Response, message?: string): void {
  sendError(res, message ?? "An unexpected error occurred. Please try again later.", 500);
}
