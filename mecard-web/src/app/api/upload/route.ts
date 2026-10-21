import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { imageDeps } from "@/lib/images/config";
import { MAX_UPLOAD_BYTES, storeArtwork, storeUpload } from "@/lib/images/pipeline";
import { currentUserId } from "@/lib/session";

// POST /api/upload/ (multipart, field "file") — profile photos and company
// logos from the editors, and card artwork (kind=artwork). Replaces the WordPress media library the editor
// opened; the path returned is saved on the record when the form is saved.

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  let file: FormDataEntryValue | null = null;
  let artwork = false;
  try {
    const form = await req.formData();
    file = form.get("file");
    // ?kind=artwork: card designs, kept as the original PNG / JPG for printing.
    artwork = form.get("kind") === "artwork";
  } catch {
    // fall through to the error below
  }
  if (!(file instanceof Blob)) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "That image is too big. The limit is 10 MB." }, { status: 413 });

  const id = `${userId}-${randomBytes(6).toString("hex")}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const path = artwork ? await storeArtwork(bytes, imageDeps(), { id }) : await storeUpload(bytes, imageDeps(), { id });
  if (!path) return NextResponse.json({ error: artwork ? "Card designs must be a PNG or JPG image." : "That file isn't an image we can use. Try a JPG or PNG." }, { status: 415 });
  console.log(JSON.stringify({ severity: "INFO", message: "image_uploaded", userId, path, bytes: file.size }));
  return NextResponse.json({ path });
}
