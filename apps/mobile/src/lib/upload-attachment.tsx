import { File } from "expo-file-system";

import { Attachment, AttachmentEntityType } from "@/lib/api";
import { apiUpload } from "@/lib/api-client";

export function uploadAttachment(
  uri: string,
  entityType: AttachmentEntityType,
  entityId: string,
) {
  const body = new FormData();
  body.append("file", new File(uri));
  body.append("entityType", entityType);
  body.append("entityId", entityId);
  return apiUpload<Attachment>("/attachments/upload", body);
}
