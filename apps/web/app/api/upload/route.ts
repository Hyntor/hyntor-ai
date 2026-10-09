// Multipart file upload endpoint (multipart doesn't flow through tRPC).
// All the real work - enrollment check, text extraction, DB write, XP -
// happens in @coursemind/api's createMaterialFromFile, so mobile can hit
// this same endpoint with its Bearer token and identical behavior.
//
// Storage, in order of preference:
//  1. Vercel Blob when BLOB_READ_WRITE_TOKEN is set (production) - the
//     original file gets a public URL students can open from the material
//     page. Enable it from the Vercel dashboard: Storage -> Create -> Blob.
//  2. Local disk in dev: files land in apps/web/uploads/ (gitignored).
//  3. Hosted WITHOUT a Blob store: the filesystem is ephemeral, so we
//     steer the student to the paste-text path instead of failing with a
//     confusing disk error.
import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { put } from "@vercel/blob";
import { createMaterialFromFile, verifyMobileToken } from "@coursemind/api";
import { auth } from "@/auth";

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function POST(req: Request) {
  // Resolve the caller from either transport (web session or mobile JWT).
  const session = await auth();
  let userId = session?.user?.id ?? null;
  if (!userId) {
    const header = req.headers.get("authorization");
    if (header?.startsWith("Bearer ")) {
      userId = await verifyMobileToken(header.slice("Bearer ".length));
    }
  }
  if (!userId) {
    return NextResponse.json({ error: "Please log in to upload." }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const courseId = form.get("courseId");
  const title = form.get("title");
  if (!(file instanceof File) || typeof courseId !== "string") {
    return NextResponse.json({ error: "Missing file or courseId." }, { status: 400 });
  }
  // Hosted with no object storage: a disk write wouldn't survive the request.
  if (process.env.VERCEL && !isBlobConfigured()) {
    return NextResponse.json(
      {
        error:
          "File uploads aren't available on the hosted site yet. Use \"Paste text\" on the upload page instead - that's exactly what the AI tutor reads, and it works the same.",
      },
      { status: 503 }
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "File is larger than 25 MB. Try splitting it or pasting the text directly." },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storedName = `${crypto.randomBytes(8).toString("hex")}-${safeName}`;

  let fileUrl: string;
  if (isBlobConfigured()) {
    // Object storage: survives deploys, and the URL opens in a browser.
    const blob = await put(`materials/${storedName}`, buffer, {
      access: "public",
      contentType: file.type || undefined,
    });
    fileUrl = blob.url;
  } else {
    const uploadsDir = path.join(process.cwd(), "uploads");
    await mkdir(uploadsDir, { recursive: true });
    await writeFile(path.join(uploadsDir, storedName), buffer);
    fileUrl = `uploads/${storedName}`;
  }

  try {
    const result = await createMaterialFromFile({
      userId,
      courseId,
      title: typeof title === "string" && title.trim() ? title.trim() : file.name,
      filename: file.name,
      buffer,
      fileUrl,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed." },
      { status: 400 }
    );
  }
}
