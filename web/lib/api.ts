import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "INTERNAL_SERVER_ERROR";

function defaultStatusForCode(code: ApiErrorCode): number {
  switch (code) {
    case "BAD_REQUEST":
    case "VALIDATION_ERROR":
      return 400;
    case "NOT_FOUND":
      return 404;
    case "INTERNAL_SERVER_ERROR":
    default:
      return 500;
  }
}

export function apiSuccess<T>(data: T, init?: { status?: number }) {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    {
      status: init?.status ?? 200,
    }
  );
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  options?: { status?: number; details?: unknown }
) {
  const status = options?.status ?? defaultStatusForCode(code);

  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details: options?.details,
      },
    },
    { status }
  );
}

export function zodError(error: ZodError) {
  return apiError("VALIDATION_ERROR", "Invalid request.", {
    status: 400,
    details: error.flatten(),
  });
}

