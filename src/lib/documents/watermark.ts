import "server-only";
import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";

/** Stamps "name · date/time" diagonally across every page (spec §9) — computed per request, so it
 * always reflects who's viewing right now, not who uploaded the file. PDFs only, per spec wording. */
export async function watermarkPdf(bytes: Buffer, label: string): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const size = 11;
  const textWidth = font.widthOfTextAtSize(label, size);

  for (const page of pdfDoc.getPages()) {
    const { width, height } = page.getSize();
    page.drawText(label, {
      x: width / 2 - textWidth / 2,
      y: height / 2,
      size,
      font,
      color: rgb(0.55, 0.55, 0.55),
      opacity: 0.45,
      rotate: degrees(45),
    });
  }

  return Buffer.from(await pdfDoc.save());
}
