import "server-only";
import net from "node:net";
import { env } from "../env";

export type ScanOutcome = { status: "CLEAN" | "INFECTED" | "ERROR"; detail?: string };

const CHUNK_SIZE = 1024 * 1024; // 1MB — comfortably under clamd's default StreamMaxLength

/**
 * Talks to clamd's INSTREAM protocol directly over TCP (spec §9) — no upload is usable until
 * this returns CLEAN. Fails closed: if REQUIRE_VIRUS_SCAN is on and the scanner can't be
 * reached, that's ERROR, never a silent CLEAN. REQUIRE_VIRUS_SCAN=false is a documented,
 * dev-only bypass (mirrors REQUIRE_2FA) for environments with no clamd running — every
 * upload still records why in DocumentVersion.scanDetail.
 */
export function scanBuffer(buf: Buffer): Promise<ScanOutcome> {
  if (!env.REQUIRE_VIRUS_SCAN) {
    return Promise.resolve({ status: "CLEAN", detail: "Scan skipped — REQUIRE_VIRUS_SCAN=false (dev only, no clamd configured)" });
  }

  return new Promise((resolve) => {
    const socket = net.createConnection({ host: env.CLAMAV_HOST, port: env.CLAMAV_PORT });
    let response = "";
    let settled = false;
    const finish = (result: ScanOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(result);
    };
    const timer = setTimeout(() => finish({ status: "ERROR", detail: "Virus scan timed out" }), 15_000);

    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      for (let offset = 0; offset < buf.length; offset += CHUNK_SIZE) {
        const chunk = buf.subarray(offset, offset + CHUNK_SIZE);
        const header = Buffer.alloc(4);
        header.writeUInt32BE(chunk.length, 0);
        socket.write(header);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4)); // zero-length chunk signals end of stream
    });
    socket.on("data", (d) => {
      response += d.toString("utf8");
    });
    socket.on("error", () => finish({ status: "ERROR", detail: "Could not reach the virus scanner" }));
    socket.on("close", () => {
      if (settled) return;
      // clamd's protocol terminates its reply with a NUL byte — Postgres's jsonb column
      // (where this ends up via writeAudit's `after` payload) rejects raw \0 outright.
      const clean = response.replace(/\0/g, "").trim();
      if (clean.includes("FOUND")) finish({ status: "INFECTED", detail: clean });
      else if (clean.includes("OK")) finish({ status: "CLEAN" });
      else finish({ status: "ERROR", detail: clean || "No response from virus scanner" });
    });
  });
}
