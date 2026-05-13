import { z } from "zod/v4";

export const draftValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string())
]);

export const draftConversationMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1)
}).strict();

export const pageCapabilityManifestSchema = z.object({
  pageId: z.string().min(1),
  route: z.string().min(1),
  visibleEntities: z.record(z.string(), z.unknown()),
  editableTargets: z.array(z.record(z.string(), z.unknown())),
  outputContract: z.record(z.string(), z.unknown())
}).strict();

export type DraftValue = z.infer<typeof draftValueSchema>;
export type DraftConversationMessage = z.infer<typeof draftConversationMessageSchema>;
export type PageCapabilityManifest = z.infer<typeof pageCapabilityManifestSchema>;
