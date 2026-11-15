import type {
  chatTodoItemSchema,
  chatTodoListSchema,
  chatTodoStatusSchema,
} from "@notra/ai/schemas/todos";
import type { z } from "zod";

export type ChatTodoItem = z.infer<typeof chatTodoItemSchema>;
export type ChatTodoList = z.infer<typeof chatTodoListSchema>;
