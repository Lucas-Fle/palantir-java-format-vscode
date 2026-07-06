import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace } = vi.hoisted(() => ({
  replace: vi.fn((range: unknown, text: string) => ({ range, newText: text }))
}));
vi.mock("vscode", () => ({
  Position: class Position {
    public constructor(
      public readonly line: number,
      public readonly character: number
    ) {}
  },
  Range: class Range {
    public constructor(
      public readonly start: unknown,
      public readonly end: unknown
    ) {}
  },
  TextEdit: { replace },
  workspace: {
    getConfiguration: () => ({
      get: (_name: string, fallback: unknown) => fallback
    })
  }
}));

import { PalantirFormattingProvider } from "../../src/formattingProvider";

function document(source: string, version = 1) {
  return {
    version,
    getText: () => source,
    positionAt: (offset: number) => ({ line: 0, character: offset })
  };
}

const options = { insertSpaces: true, tabSize: 4 };

describe("PalantirFormattingProvider", () => {
  beforeEach(() => replace.mockClear());

  it("returns one complete-document edit", async () => {
    const provider = new PalantirFormattingProvider(
      { formatDocument: () => Promise.resolve("class Example {}\n") },
      vi.fn()
    );
    const edits = await provider.provideDocumentFormattingEdits(
      document("class Example{}") as never,
      options,
      { isCancellationRequested: false } as never
    );
    expect(edits).toHaveLength(1);
    expect(edits[0]?.newText).toBe("class Example {}\n");
  });

  it("returns no edit when formatting is cancelled", async () => {
    const formatter = vi.fn(() => Promise.resolve("formatted"));
    const provider = new PalantirFormattingProvider({ formatDocument: formatter }, vi.fn());
    const edits = await provider.provideDocumentFormattingEdits(
      document("source") as never,
      options,
      { isCancellationRequested: true } as never
    );
    expect(edits).toEqual([]);
    expect(formatter).not.toHaveBeenCalled();
  });

  it("discards a stale response", async () => {
    let release: ((value: string) => void) | undefined;
    const formatted = new Promise<string>((resolve) => {
      release = resolve;
    });
    const mutableDocument = document("source");
    const provider = new PalantirFormattingProvider(
      { formatDocument: () => formatted },
      vi.fn()
    );
    const pending = provider.provideDocumentFormattingEdits(
      mutableDocument as never,
      options,
      { isCancellationRequested: false } as never
    );
    mutableDocument.version = 2;
    release?.("formatted");
    await expect(pending).resolves.toEqual([]);
  });

  it("keeps the document unchanged and reports formatter errors", async () => {
    const report = vi.fn();
    const provider = new PalantirFormattingProvider(
      {
        formatDocument: () => Promise.reject(new Error("invalid Java"))
      },
      report
    );
    await expect(
      provider.provideDocumentFormattingEdits(
        document("class {") as never,
        options,
        { isCancellationRequested: false } as never
      )
    ).resolves.toEqual([]);
    expect(report).toHaveBeenCalledWith(expect.stringContaining("invalid Java"));
  });
});
