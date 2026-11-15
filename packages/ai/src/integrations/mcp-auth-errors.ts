import { Effect, Schema } from "effect";

export class McpUnauthorizedError extends Schema.TaggedError<McpUnauthorizedError>()(
  "McpUnauthorizedError",
  {
    message: Schema.String.pipe(
      Schema.withConstructorDefault(
        Effect.succeed("The MCP server rejected the access token.")
      )
    ),
    statusCode: Schema.Literal(401).pipe(
      Schema.withConstructorDefault(Effect.succeed(401 as const))
    ),
  }
) {}
