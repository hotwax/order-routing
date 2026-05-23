import { z } from "zod/v4";
import {
  draftConversationMessageSchema,
  pageCapabilityManifestSchema
} from "./pageCapabilitySchema";

export const runsListIntentSchema = z.enum([
  "config_lookup",
  "behavior_diagnostic",
  "environmental_audit",
  "recommendation"
]);

export const brokeringRunsListInquirySchema = z.object({
  answer: z.string().min(1),
  questions: z.array(z.string().min(1)),
  summary: z.string().min(1),
  intent: runsListIntentSchema.optional(),
  matchedPatternId: z.string().min(1).nullable().optional()
}).strict();

export const brokeringRunsListInquiryRequestSchema = z.object({
  prompt: z.string().min(1),
  conversationHistory: z.array(draftConversationMessageSchema).default([]),
  pageCapabilityManifest: pageCapabilityManifestSchema,
  omsBaseUrl: z.string().min(1).optional(),
  authToken: z.string().min(1).optional()
}).strict();

export type BrokeringRunsListInquiry = z.infer<typeof brokeringRunsListInquirySchema>;
export type BrokeringRunsListInquiryRequest = z.infer<typeof brokeringRunsListInquiryRequestSchema>;

export type RunsListIntent = z.infer<typeof runsListIntentSchema>;

export type BrokeringRunsListInquiryResponse = {
  schemaVersion: "brokering-runs-list-inquiry.v1";
  message: string;
  questions: string[];
  summary: string;
  intent?: RunsListIntent;
  matchedPatternId?: string;
};
