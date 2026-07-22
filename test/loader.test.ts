import { describe, expect, it } from "vitest";
import { normalizeMock, resolveMocks } from "../src/loader.js";

describe("normalizeMock", () => {
  it("applies defaults", () => {
    const m = normalizeMock({ path: "/a" });
    expect(m).toMatchObject({ method: "GET", path: "/a", status: 200, delay: 0 });
  });
  it("upper-cases the method", () => {
    const m = normalizeMock({ path: "/a", method: "post" as never });
    expect(m.method).toBe("POST");
  });
  it("applies the base path", () => {
    const m = normalizeMock({ path: "/users" }, "/api");
    expect(m.path).toBe("/api/users");
  });
  it("copies headers", () => {
    const headers = { "X-A": "b" };
    const m = normalizeMock({ path: "/a", headers });
    expect(m.headers).toEqual(headers);
    expect(m.headers).not.toBe(headers);
  });
  it("throws when path is missing", () => {
    expect(() => normalizeMock({} as never)).toThrow();
  });
});

describe("resolveMocks", () => {
  it("resolves a list of definitions", () => {
    const result = resolveMocks([
      { path: "/a", response: "a" },
      { path: "/b", response: "b" },
    ]);
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.path)).toEqual(["/a", "/b"]);
  });

  it("dedups by method+path, later entry wins", () => {
    const result = resolveMocks([
      { path: "/users", response: "first" },
      { path: "/users", response: "second" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.response).toBe("second");
  });

  it("keeps distinct methods separate", () => {
    const result = resolveMocks([
      { path: "/users", response: "list" },
      { path: "/users", method: "POST", response: "created" },
    ]);
    expect(result).toHaveLength(2);
  });

  it("applies the base path to every mock", () => {
    const result = resolveMocks(
      [{ path: "/users" }, { path: "/posts" }],
      "/api",
    );
    expect(result.map((m) => m.path).sort()).toEqual(["/api/posts", "/api/users"]);
  });

  it("returns an empty list for no mocks", () => {
    expect(resolveMocks([])).toEqual([]);
  });
});
