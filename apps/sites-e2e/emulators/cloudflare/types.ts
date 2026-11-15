export interface CustomHostname {
  id: string;
  hostname: string;
  status: string;
  ownership_verification: { type: "txt"; name: string; value: string };
  ssl: {
    status: string;
    method: string;
    type: string;
    validation_records: { http_url: string; http_body: string }[];
    validation_errors?: { message: string }[];
  };
  verification_errors?: string[];
  created_at: string;
}

export interface CloudflareEmulatorOptions {
  zoneId: string;
  apiToken: string;
  /** The CNAME target customers point their hostname at. */
  cnameTarget: string;
}
