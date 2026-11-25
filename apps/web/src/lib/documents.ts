import "server-only";
import { HttpError, scanUpload, sniffUpload } from "./security";

/** Turn an uploaded file into page texts. PDFs are parsed server-side; nothing is executed. */
export async function fileToPages(file: File): Promise<{ name: string; pages: string[]; bytes: number }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffUpload(file.name, bytes);
  const scan = await scanUpload(file.name, bytes);
  if (!scan.clean) throw new HttpError(422, "The file was rejected by the malware scanner.");
  const name = file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 200) || "document";
  if (kind === "text") return { name, pages: [new TextDecoder("utf-8", { fatal: false }).decode(bytes)], bytes: bytes.length };
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    if (pdf.numPages > 500) throw new HttpError(413, "PDFs over 500 pages are not supported.");
    const { text } = await extractText(pdf, { mergePages: false });
    return { name, pages: (Array.isArray(text) ? text : [text]).map((t) => t.replace(/\u0000/g, "")), bytes: bytes.length };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(422, "This PDF could not be read. It may be encrypted or damaged.");
  }
}
