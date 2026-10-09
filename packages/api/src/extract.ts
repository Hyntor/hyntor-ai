// Server-side text extraction from uploaded course materials.
// The extracted text is what grounds every AI answer, so extraction
// quality directly drives tutor quality.
//
// Supported: PDF (pdf-parse), DOCX (mammoth), PPTX (jszip + slide XML),
// and plain text/markdown. Anything else is stored un-extracted with a
// clear note so the uploader knows the AI can't read it.
import mammoth from "mammoth";
import JSZip from "jszip";
import type { MaterialType } from "@coursemind/core";

// pdf-parse's index.js runs a debug harness when it thinks it's the main
// module, which crashes under bundlers. Importing the lib file directly
// skips that. Keep "pdf-parse" in next.config serverExternalPackages.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require("pdf-parse/lib/pdf-parse.js");

export interface ExtractionResult {
  text: string;
  materialType: MaterialType;
  warning?: string;
}

const MAX_STORED_CHARS = 400_000; // ~100k tokens; plenty, keeps DB rows sane

export async function extractTextFromFile(
  buffer: Buffer,
  filename: string
): Promise<ExtractionResult> {
  const ext = (filename.split(".").pop() ?? "").toLowerCase();
  try {
    switch (ext) {
      case "pdf": {
        const result = await pdfParse(buffer);
        return finish(result.text, "PDF");
      }
      case "docx": {
        const result = await mammoth.extractRawText({ buffer });
        return finish(result.value, "DOCX");
      }
      case "pptx": {
        const text = await extractPptxText(buffer);
        return finish(text, "PPTX");
      }
      case "txt":
      case "md":
      case "markdown": {
        return finish(buffer.toString("utf-8"), "TEXT");
      }
      default:
        return {
          text: "",
          materialType: "OTHER",
          warning: `Files of type .${ext} can't be read yet - the file is stored, but the AI tutor can't use its contents. Supported: PDF, DOCX, PPTX, TXT, MD.`,
        };
    }
  } catch (err) {
    return {
      text: "",
      materialType: typeFromExt(ext),
      warning: `The file was stored, but text extraction failed (${err instanceof Error ? err.message : "unknown error"}). The AI tutor won't be able to use its contents. Try re-exporting the file or pasting the text directly.`,
    };
  }
}

function finish(raw: string, materialType: MaterialType): ExtractionResult {
  const text = raw.replace(/\r\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();
  if (text.length === 0) {
    return {
      text: "",
      materialType,
      warning:
        "No text could be extracted - this often means a scanned/image-only PDF. The file is stored, but the AI tutor can't read it. Try an OCR'd copy or paste the text directly.",
    };
  }
  return { text: text.slice(0, MAX_STORED_CHARS), materialType };
}

function typeFromExt(ext: string): MaterialType {
  if (ext === "pdf") return "PDF";
  if (ext === "docx") return "DOCX";
  if (ext === "pptx") return "PPTX";
  if (["txt", "md", "markdown"].includes(ext)) return "TEXT";
  return "OTHER";
}

// PPTX = a zip of XML files; slide text lives in <a:t> runs inside
// ppt/slides/slideN.xml. A full XML parser is overkill for pulling text.
async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => slideNumber(a) - slideNumber(b));

  const slides: string[] = [];
  for (const name of slideNames) {
    const xml = await zip.files[name].async("string");
    const runs = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => decodeXml(m[1]));
    if (runs.length > 0) {
      slides.push(`[Slide ${slideNumber(name)}]\n${runs.join(" ")}`);
    }
  }
  return slides.join("\n\n");
}

function slideNumber(name: string): number {
  return Number(name.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
