import { describe, expect, it } from "vitest";
import { previewText, stripMentionTokens } from "./mentions";

describe("stripMentionTokens", () => {
  it("turns a mention token into @Name", () => {
    expect(stripMentionTokens("@[Agnes Nakato](user:cmw68tej300041ou4ovr8w8db) you have to finish this on time please")).toBe(
      "@Agnes Nakato you have to finish this on time please",
    );
  });
  it("handles several mentions", () => {
    expect(stripMentionTokens("@[A B](user:1) and @[C D](user:2) please review")).toBe("@A B and @C D please review");
  });
  it("cleans a token that was cut off mid-id", () => {
    expect(stripMentionTokens("hello @[Agnes Nakato](user:cmw68te")).toBe("hello @Agnes Nakato");
    expect(stripMentionTokens("hello @[Agnes Nak")).toBe("hello");
  });
  it("leaves ordinary text alone", () => {
    expect(stripMentionTokens("Filed on 3 Oct (see [1])")).toBe("Filed on 3 Oct (see [1])");
  });
});

describe("previewText", () => {
  it("resolves tokens before truncating, so no id leaks", () => {
    const body = `@[Agnes Nakato](user:cmw68tej300041ou4ovr8w8db) ${"x".repeat(200)}`;
    const out = previewText(body, 40);
    expect(out).not.toContain("user:");
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out.endsWith("…")).toBe(true);
  });
  it("does not add an ellipsis to short text", () => expect(previewText("short", 40)).toBe("short"));
});
