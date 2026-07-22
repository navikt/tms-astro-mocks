import type { ServerResponse } from "node:http";
import type { MockResult, ResolvedMock } from "./types.js";

/**
 * Resolve the raw result of a mock into a normalized `Response`-like shape:
 * status, headers and a body buffer/string.
 */
async function toParts(
  mock: ResolvedMock,
  result: MockResult,
): Promise<{ status: number; headers: Record<string, string>; body: string | Buffer | null }> {
  // A standard Response is authoritative for status/headers/body.
  if (result instanceof Response) {
    const headers: Record<string, string> = {};
    result.headers.forEach((value, key) => {
      headers[key] = value;
    });
    const text = await result.text();
    return {
      status: result.status,
      headers,
      body: text.length > 0 ? text : null,
    };
  }

  const headers: Record<string, string> = { ...mock.headers };

  if (result === undefined || result === null) {
    return { status: mock.status, headers, body: null };
  }

  if (typeof result === "string") {
    if (!hasHeader(headers, "content-type")) {
      headers["Content-Type"] = "text/plain; charset=utf-8";
    }
    return { status: mock.status, headers, body: result };
  }

  if (Buffer.isBuffer(result)) {
    return { status: mock.status, headers, body: result };
  }

  // Anything else: JSON-serialize.
  if (!hasHeader(headers, "content-type")) {
    headers["Content-Type"] = "application/json; charset=utf-8";
  }
  return { status: mock.status, headers, body: JSON.stringify(result) };
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const lower = name.toLowerCase();
  return Object.keys(headers).some((k) => k.toLowerCase() === lower);
}

/**
 * Write a mock result to the Node `ServerResponse`, applying the configured
 * delay, status, headers and serialized body.
 */
export async function sendResult(
  res: ServerResponse,
  mock: ResolvedMock,
  result: MockResult,
): Promise<void> {
  if (mock.delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, mock.delay));
  }

  const { status, headers, body } = await toParts(mock, result);

  res.statusCode = status;
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }

  if (body === null) {
    res.end();
    return;
  }
  res.end(body);
}
