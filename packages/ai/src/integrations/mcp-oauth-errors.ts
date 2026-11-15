import { Effect, Schema } from "effect";

export class McpOAuthAuthorizationError extends Schema.TaggedError<McpOAuthAuthorizationError>()(
  "McpOAuthAuthorizationError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect()),
  }
) {}

export class McpOAuthRefreshTokenRequiredError extends Schema.TaggedError<McpOAuthRefreshTokenRequiredError>()(
  "McpOAuthRefreshTokenRequiredError",
  {
    message: Schema.String.pipe(
      Schema.withConstructorDefault(
        Effect.succeed(
          "This MCP server did not issue a refresh token, so Notra cannot keep the connection signed in."
        )
      )
    ),
  }
) {}

export class McpOAuthReauthorizationRequiredError extends Schema.TaggedError<McpOAuthReauthorizationRequiredError>()(
  "McpOAuthReauthorizationRequiredError",
  {
    message: Schema.String.pipe(
      Schema.withConstructorDefault(
        Effect.succeed("Reconnect this MCP server to restore OAuth access.")
      )
    ),
  }
) {}

export class McpOAuthNameConflictError extends Schema.TaggedError<McpOAuthNameConflictError>()(
  "McpOAuthNameConflictError",
  {
    message: Schema.String.pipe(
      Schema.withConstructorDefault(
        Effect.succeed("An MCP server with this name already exists.")
      )
    ),
  }
) {}
