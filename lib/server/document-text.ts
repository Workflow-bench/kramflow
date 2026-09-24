import "server-only";
import * as XLSX from "xlsx";

// Turns an uploaded document into plain text for the AI import. Spreadsheets
// are flattened to CSV per sheet so the model sees rows and columns; text
// files are read as-is. PDF and Word aren't handled yet — paste their text.

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
// ~100k tokens: well inside the model's context, and far past any real run
// of show. Refuse rather than silently truncate — a cut-off cue sheet would
// import as a plausible but incomplete one.
export const MAX_DOCUMENT_CHARS = 400_000;

const MAX_SHEETS = 50;
const MAX_ROWS_PER_SHEET = 5000;

export class DocumentTextError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export async function extractDocumentText(file: File): Promise<string> {
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new DocumentTextError(`File too large (${Math.round(file.size / 1024 / 1024)}MB). The limit is 10MB.`, 413);
  }
  const name = file.name.toLowerCase();

  let text: string;
  if (name.endsWith(".xlsx")) {
    // xlsx (SheetJS) has open advisories for hostile files; the size cap
    // above and the sheet/row ceilings below bound what it is asked to do,
    // as in lib/parse-cuesheet.ts.
    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
    if (wb.SheetNames.length > MAX_SHEETS) {
      throw new DocumentTextError(`Too many sheets (${wb.SheetNames.length}). The limit is ${MAX_SHEETS}.`, 400);
    }
    const parts: string[] = [];
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const ref = sheet["!ref"];
      const range = ref ? XLSX.utils.decode_range(ref) : null;
      const rowCount = range ? range.e.r - range.s.r + 1 : 0;
      if (rowCount > MAX_ROWS_PER_SHEET) {
        throw new DocumentTextError(`Sheet "${sheetName}" has too many rows (${rowCount}). The limit is ${MAX_ROWS_PER_SHEET}.`, 400);
      }
      parts.push(`## Sheet: ${sheetName}\n${XLSX.utils.sheet_to_csv(sheet, { blankrows: false })}`);
    }
    text = parts.join("\n\n");
  } else if (name.endsWith(".csv") || name.endsWith(".txt") || name.endsWith(".md")) {
    text = await file.text();
  } else {
    throw new DocumentTextError("Unsupported file type. Use .xlsx, .csv or .txt, or paste the text.", 415);
  }

  return checkLength(text);
}

export function checkLength(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) throw new DocumentTextError("The document is empty.", 400);
  if (trimmed.length > MAX_DOCUMENT_CHARS) {
    throw new DocumentTextError("The document is too long to import in one go. Split it by day and import each part.", 413);
  }
  return trimmed;
}
