export type UploadType =
  | "avatar"
  | "logo"
  | "brand_asset"
  | "brand_guideline_pdf"
  | "content"
  | "chat";

/** Response from the upload presign procedure */
export interface UploadPresignedResponse {
  /** Presigned PUT URL for direct upload to R2; absent when the file is reused */
  url?: string;
  /** True when an identical, already verified chat upload is reused */
  reused?: boolean;
  /** Object key in the bucket (e.g. avatars/yGE3_Yy8w6F5TFG-iiikk.webp) */
  key: string;
  /** Public URL to access the file after upload */
  publicUrl: string;
}

export interface UploadFileResponse {
  url: string;
  key: string;
}

export interface UploadFileProps {
  file: File;
  type: UploadType;
  /** SHA-256 hex of `file` when the caller already hashed it */
  sha256?: string;
}

export interface DeleteChatUploadProps {
  key: string;
}

export interface ChatUploadCandidate {
  file: File;
  /** Present unless the file is converted before upload */
  sha256?: string;
}
