import { describe, expect, it } from "vitest";
import { joinPath, matchPath, normalizePath } from "../src/match.js";

describe("normalizePath", () => {
  it("adds a leading slash", () => {
    expect(normalizePath("users")).toBe("/users");
  });
  it("strips a trailing slash", () => {
    expect(normalizePath("/users/")).toBe("/users");
  });
  it("keeps root as /", () => {
    expect(normalizePath("/")).toBe("/");
  });
});

describe("joinPath", () => {
  it("prefixes a base path", () => {
    expect(joinPath("/api", "/users")).toBe("/api/users");
  });
  it("works without a base path", () => {
    expect(joinPath(undefined, "users")).toBe("/users");
  });
  it("normalizes the base path", () => {
    expect(joinPath("api/", "/users/")).toBe("/api/users");
  });
});

describe("matchPath", () => {
  it("matches an exact path", () => {
    expect(matchPath("/users", "/users")).toEqual({});
  });
  it("returns null for a mismatch", () => {
    expect(matchPath("/users", "/posts")).toBeNull();
  });
  it("returns null for differing segment counts", () => {
    expect(matchPath("/users", "/users/1")).toBeNull();
  });
  it("extracts a single param", () => {
    expect(matchPath("/users/:id", "/users/42")).toEqual({ id: "42" });
  });
  it("extracts multiple params", () => {
    expect(matchPath("/users/:id/posts/:postId", "/users/7/posts/9")).toEqual({
      id: "7",
      postId: "9",
    });
  });
  it("decodes URI components in params", () => {
    expect(matchPath("/search/:term", "/search/hello%20world")).toEqual({
      term: "hello world",
    });
  });
  it("matches the root path", () => {
    expect(matchPath("/", "/")).toEqual({});
  });
  it("ignores trailing slashes", () => {
    expect(matchPath("/users/:id", "/users/5/")).toEqual({ id: "5" });
  });
});
