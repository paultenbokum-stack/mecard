import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { imageDeps } from "@/lib/images/config";
import { MAX_UPLOAD_BYTES, storeArtwork, storeUpload } from "@/lib/images/pipeline";
import { canManageCompany, viewer } from "@/lib/access";
import { recordUpload } from "@/lib/media-library";
import { currentUserId } from "@/lib/session";

// POST /api/upload/ (multipart, field "file") — profile photos and company
// logos from the editors, and card artwork (kind=artwork). Every upload goes into
// the uploader's media library (company_id: shared with a company they manage);
// the path returned is saved on the record when the form is saved.

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  let file: FormDataEntryValue | null = null;
  let artwork = false;
  let companyId = 0;
  try {
    const form = await req.formData();
    file = form.get("file");
    // ?kind=artwork: card designs, kept as the original PNG / JPG for printing.
    artwork = form.get("kind") === "artwork";
    companyId = Number(form.get("company_id")) || 0;
  } catch {
    // fall through to the error below
  }
  if (!(file instanceof Blob)) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "That image is too big. The limit is 10 MB." }, { status: 413 });

  const id = `${userId}-${randomBytes(6).toString("hex")}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const path = artwork ? await storeArtwork(bytes, imageDeps(), { id }) : await storeUpload(bytes, imageDeps(), { id });
  if (!path) return NextResponse.json({ error: artwork ? "Card designs must be a PNG or JPG image." : "That file isn't an image we can use. Try a JPG or PNG." }, { status: 415 });
  const shareWith = companyId && (await canManageCompany(await viewer(userId), companyId)) ? companyId : null;
  await recordUpload({ ownerId: userId, companyId: shareWith, path, filename: file instanceof File ? file.name : "", mimeType: file.type, bytes: file.size });
  console.log(JSON.stringify({ severity: "INFO", message: "image_uploaded", userId, path, bytes: file.size }));
  return NextResponse.json({ path });
}
