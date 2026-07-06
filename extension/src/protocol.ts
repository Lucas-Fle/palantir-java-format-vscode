import { randomUUID } from "node:crypto";

import { PROTOCOL_VERSION } from "./constants";

export interface InitializeResult {
  workerVersion: string;
  formatterVersion: string;
}

export interface FormatDocumentResult {
  formatted: string;
}

export const PROTOCOL_ERROR_CODES = [
  "INVALID_REQUEST",
  "INCOMPATIBLE_PROTOCOL",
  "METHOD_NOT_FOUND",
  "FORMAT_ERROR",
  "INTERNAL_ERROR"
] as const;

export type ProtocolErrorCode = (typeof PROTOCOL_ERROR_CODES)[number];

export interface ProtocolError {
  code: ProtocolErrorCode;
  message: string;
}

interface ProtocolSuccess<TResult = unknown> {
  protocolVersion: number;
  id: string | null;
  result: TResult;
}

interface ProtocolFailure {
  protocolVersion: number;
  id: string | null;
  error: ProtocolError;
}

export type ProtocolResponse<TResult = unknown> = ProtocolSuccess<TResult> | ProtocolFailure;

interface ProtocolMethodDefinition {
  initialize: Record<string, never>;
  formatDocument: { source: string };
  shutdown: Record<string, never>;
}

export type ProtocolMethod = keyof ProtocolMethodDefinition;

export type ProtocolRequest<TMethod extends ProtocolMethod = ProtocolMethod> = {
  [Method in TMethod]: {
    protocolVersion: number;
    id: string;
    method: Method;
    params: ProtocolMethodDefinition[Method];
  };
}[TMethod];

export function createRequest<TMethod extends ProtocolMethod>(
  method: TMethod,
  params: ProtocolMethodDefinition[TMethod]
): ProtocolRequest<TMethod> {
  return {
    protocolVersion: PROTOCOL_VERSION,
    id: randomUUID(),
    method,
    params
  };
}

export function isProtocolResponse(value: unknown): value is ProtocolResponse {
  if (!isRecord(value)) {
    return false;
  }
  if (
    value.protocolVersion !== PROTOCOL_VERSION ||
    (typeof value.id !== "string" && value.id !== null)
  ) {
    return false;
  }

  const hasResult = Object.hasOwn(value, "result");
  const hasError = Object.hasOwn(value, "error");
  if (hasResult === hasError) {
    return false;
  }
  if (hasResult) {
    return (
      hasExactKeys(value, ["protocolVersion", "id", "result"]) &&
      (isInitializeResult(value.result) ||
        isFormatDocumentResult(value.result) ||
        isShutdownResult(value.result))
    );
  }
  return (
    hasExactKeys(value, ["protocolVersion", "id", "error"]) &&
    isProtocolError(value.error)
  );
}

export function isInitializeResult(value: unknown): value is InitializeResult {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["workerVersion", "formatterVersion"]) &&
    typeof value.workerVersion === "string" &&
    typeof value.formatterVersion === "string"
  );
}

export function isFormatDocumentResult(value: unknown): value is FormatDocumentResult {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["formatted"]) &&
    typeof value.formatted === "string"
  );
}

function isShutdownResult(value: unknown): value is Record<string, never> {
  return isRecord(value) && hasExactKeys(value, []);
}

function isProtocolError(value: unknown): value is ProtocolError {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["code", "message"]) &&
    isProtocolErrorCode(value.code) &&
    typeof value.message === "string"
  );
}

function isProtocolErrorCode(value: unknown): value is ProtocolErrorCode {
  return (
    typeof value === "string" &&
    (PROTOCOL_ERROR_CODES as readonly string[]).includes(value)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}
