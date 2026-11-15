export type RedisRestCommand = [string, ...(string | number)[]];

export type RedisRestResult =
  | string
  | number
  | boolean
  | null
  | { error: string }
  | RedisRestResult[];

export type RedisRestReply = { result: RedisRestResult } | { error: string };
