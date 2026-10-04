import "server-only";
import * as XLSX from "xlsx";
import { XLSX_READ_OPTIONS, workbookLimitViolation } from "@/lib/xlsx-limits";

// Turns an uploaded document into plain text for the AI import. Spreadsheets
// are flattened to CSV per sheet so the model sees rows and columns; text
// files are read as-is. PDF and Word aren't handled yet — paste their text.

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
// ~100k tokens: well inside the model's context, and far past any real run
// of show. Refuse rather than silently truncate — a cut-off cue sheet would
// import as a plausible but incomplete one.
export const MAX_DOCUMENT_CHARS = 400_000;


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
    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), XLSX_READ_OPTIONS);
    const violation = workbookLimitViolation(wb);
    if (violation) throw new DocumentTextError(violation, 400);
    const parts: string[] = [];
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
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
