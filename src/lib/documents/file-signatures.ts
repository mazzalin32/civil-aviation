/**
 * Verifies a file's type from its content, not its extension (spec §9) — catches, for
 * example, an executable renamed to .pdf. Deliberately a short allow-list: only the kinds of
 * files a legal file actually holds (spec §5.7 tab 2 folders: pleadings, evidence, orders,
 * correspondence, memos).
 */
const SIGNATURES: { mimeType: string; label: string; check: (b: Buffer) => boolean }[] = [
  { mimeType: "application/pdf", label: "PDF", check: (b) => b.subarray(0, 4).toString("ascii") === "%PDF" },
  { mimeType: "image/png", label: "PNG", check: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mimeType: "image/jpeg", label: "JPEG", check: (b) => b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) },
  {
    // .docx/.xlsx/.pptx are all zip containers — the signature only proves "a real Office
    // zip", not which one; that's fine here since the allow-list already blocks non-Office use.
    mimeType: "application/zip-office",
    label: "Word/Excel/PowerPoint",
    check: (b) => b.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])),
  },
  {
    mimeType: "text/plain",
    label: "Text",
    check: (b) => {
      const sample = b.subarray(0, Math.min(b.length, 2000));
      let printable = 0;
      for (const byte of sample) if (byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte < 127)) printable++;
      return sample.length > 0 && printable / sample.length > 0.95;
    },
  },
];

export function detectFileType(buf: Buffer): { mimeType: string; label: string } | null {
  for (const sig of SIGNATURES) {
    if (sig.check(buf)) return { mimeType: sig.mimeType, label: sig.label };
  }
  return null;
}
