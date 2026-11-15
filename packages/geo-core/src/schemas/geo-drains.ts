import { array, number, object, record, string, union } from "zod";

const numberOrString = union([number(), string()]);

export const vercelDrainLogSchema = object({
  id: string().nullish(),
  requestId: string().nullish(),
  source: string().nullish(),
  timestamp: number().nullish(),
  proxy: object({
    timestamp: number().nullish(),
    method: string(),
    host: string(),
    path: string(),
    scheme: string().nullish(),
    userAgent: array(string()).nullish(),
    referer: string().nullish(),
    statusCode: number().nullish(),
    clientIp: string().nullish(),
    vercelId: string().nullish(),
  }),
});

export const cloudflareLogpushRecordSchema = object({
  ClientRequestMethod: string(),
  ClientRequestHost: string(),
  ClientRequestURI: string(),
  ClientRequestScheme: string().nullish(),
  ClientRequestSource: string().nullish(),
  ClientRequestUserAgent: string().nullish(),
  ClientRequestReferer: string().nullish(),
  ClientIP: string().nullish(),
  ClientCountry: string().nullish(),
  ClientRegionCode: string().nullish(),
  EdgeResponseStatus: number().nullish(),
  EdgeStartTimestamp: numberOrString.nullish(),
  RayID: string().nullish(),
  RequestHeaders: record(
    string(),
    union([string(), array(string())]).nullable()
  ).nullish(),
});
