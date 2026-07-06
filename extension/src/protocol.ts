import { randomUUID } from "node:crypto";

import { PROTOCOL_VERSION } from "./constants";

export interface InitializeResult {
  workerVersion: string;
  formatterVersion: string;
}

export interface FormatDocumentResult {
  formatted: string;
}

export interface ProtocolError {
  code: string;
  message: string;
}

export interface ProtocolResponse<TResult = unknown> {
  protocolVersion: number;
  id: string | null;
  result?: TResult;
  error?: ProtocolError;
}

export interface ProtocolRequest<TParams = unknown> {
  protocolVersion: number;
  id: string;
  method: string;
  params: TParams;
}

export function createRequest<TParams>(method: string, params: TParams): ProtocolRequest<TParams> {
  return {
    protocolVersion: PROTOCOL_VERSION,
    id: randomUUID(),
    method,
    params
  };
}

export function isProtocolResponse(value: unknown): value is ProtocolResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.protocolVersion === PROTOCOL_VERSION &&
    (typeof candidate.id === "string" || candidate.id === null) &&
    (candidate.result !== undefined || candidate.error !== undefined)
  );
}
