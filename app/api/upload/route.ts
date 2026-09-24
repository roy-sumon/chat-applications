import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "audio/webm",
  "audio/ogg",
  "audio/mp3",
  "audio/mpeg",
  "audio/wav",
  "application/pdf",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds maximum allowed size of 10MB" },
        { status: 400 }
      );
    }

    // Validate MIME type
    if (
      !ALLOWED_MIME_TYPES.includes(file.type) &&
      !file.type.startsWith("image/") &&
      !file.type.startsWith("audio/")
    ) {
      return NextResponse.json(
        { error: "File type not supported. Allowed: images, audio, PDF, documents, ZIP." },
        { status: 400 }
      );
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // 1. If Cloudinary credentials configured, upload to Cloudinary
    if (cloudName && apiKey && apiSecret) {
      try {
        const timestamp = Math.round(new Date().getTime() / 1000);
        const signatureString = `timestamp=${timestamp}${apiSecret}`;
        const signature = crypto.createHash("sha1").update(signatureString).digest("hex");

        const cloudFormData = new FormData();
        const blob = new Blob([fileBuffer], { type: file.type });
        cloudFormData.append("file", blob, file.name);
        cloudFormData.append("api_key", apiKey);
        cloudFormData.append("timestamp", timestamp.toString());
        cloudFormData.append("signature", signature);
        if (uploadPreset) {
          cloudFormData.append("upload_preset", uploadPreset);
        }

        const resourceType = file.type.startsWith("image/") ? "image" : "raw";
        const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

        const response = await fetch(uploadUrl, {
          method: "POST",
          body: cloudFormData,
        });

        if (response.ok) {
          const result = await response.json();
          return NextResponse.json({
            url: result.secure_url,
            name: file.name,
            size: file.size,
            type: file.type.startsWith("image/") ? "IMAGE" : "FILE",
            mimeType: file.type,
          });
        } else {
          console.warn("[Upload] Cloudinary upload returned error status, falling back to local storage.");
        }
      } catch (cloudErr) {
        console.warn("[Upload] Cloudinary error, falling back to local storage:", cloudErr);
      }
    }

    // 2. Fallback to local storage (in public/uploads/)
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const ext = path.extname(file.name) || (file.type.startsWith("image/") ? ".jpg" : "");
    const safeBase = path
      .basename(file.name, ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 30);
    const uniqueFileName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}-${safeBase}${ext}`;
    const filePath = path.join(uploadDir, uniqueFileName);

    await writeFile(filePath, fileBuffer);

    const publicUrl = `/uploads/${uniqueFileName}`;

    return NextResponse.json({
      url: publicUrl,
      name: file.name,
      size: file.size,
      type: file.type.startsWith("image/") ? "IMAGE" : "FILE",
      mimeType: file.type,
    });
  } catch (error) {
    console.error("[Upload API] Error processing upload:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
