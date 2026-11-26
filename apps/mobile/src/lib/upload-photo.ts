import * as ImageManipulator from "expo-image-manipulator";
import { apiFetch } from "./api-client";

export type UploadPurpose =
  "order" | "pattern" | "sample" | "material" | "delivery";

export interface UploadedAttachment {
  id: string;
  key: string;
  status: "READY";
  url: string;
}

export async function uploadPhoto(
  localUri: string,
  purpose: UploadPurpose,
): Promise<UploadedAttachment> {
  // 1. Resize to max 1600px width & compress to JPEG
  const manipulated = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1600 } }],
    { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG },
  );

  // 2. Read as blob to get exact byte size
  const fileRes = await fetch(manipulated.uri);
  const blob = await fileRes.blob();

  // 3. Request presigned PUT URL
  const { attachmentId, uploadUrl } = await apiFetch<{
    attachmentId: string;
    key: string;
    uploadUrl: string;
  }>("/files/presign", {
    method: "POST",
    body: {
      mimeType: "image/jpeg",
      sizeBytes: blob.size,
      purpose,
    },
  });

  // 4. Upload directly to R2/S3
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: blob,
  });

  if (!putRes.ok) {
    throw new Error(`Storage upload failed (${putRes.status})`);
  }

  // 5. Confirm with API
  return apiFetch<UploadedAttachment>(`/files/${attachmentId}/confirm`, {
    method: "POST",
  });
}
