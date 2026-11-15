export interface R2EmulatorOptions {
  bucket: string;
  accessKeyId: string;
  /** Objects per ListObjectsV2 page; below 1000 exercises pagination. */
  pageSize?: number;
}

export interface StoredObject {
  body: Uint8Array<ArrayBuffer>;
  etag: string;
  contentType: string | null;
  cacheControl: string | null;
  lastModified: Date;
}
