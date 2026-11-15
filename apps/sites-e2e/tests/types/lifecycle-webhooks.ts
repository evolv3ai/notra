export interface LifecycleWebhookDelivery {
  event: string;
  deliveryId: string | null;
  signature: string | null;
  rawBody: string;
  after: string | null;
  jobIds: string[];
  status: number;
}
