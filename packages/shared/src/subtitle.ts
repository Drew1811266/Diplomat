import { z } from "zod";

export const LanguageCodeSchema = z.string().min(2).max(12);

export const ReviewStatusSchema = z.enum(["draft", "reviewed", "approved"]);

export const WordTimingSchema = z
  .object({
    text: z.string(),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().nonnegative(),
    confidence: z.number().min(0).max(1).nullable()
  })
  .refine((word) => word.endMs >= word.startMs, {
    message: "word endMs must be greater than or equal to startMs"
  });

export const StyleOverridesSchema = z.object({
  fontSize: z.number().positive().optional(),
  position: z.string().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  strokeWidth: z.number().nonnegative().optional()
}).strict();

export const AiOriginSchema = z.object({
  engine: z.string(),
  model: z.string()
});

export const TranslationStatusSchema = z.enum([
  "not_requested",
  "queued",
  "translated",
  "edited",
  "failed"
]);

export const TranslationOriginSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1)
});

export const SpeakerSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  color: z.string().min(1),
  styleId: z.string().min(1),
  mergedInto: z.string().nullable()
});

export const SubtitleStyleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  fontFamily: z.string().min(1),
  fontSize: z.number().positive(),
  primaryColor: z.string().min(1),
  secondaryColor: z.string().min(1),
  strokeWidth: z.number().nonnegative(),
  shadow: z.number().nonnegative(),
  position: z.string().min(1),
  marginV: z.number().int().nonnegative(),
  alignment: z.string().min(1),
  bilingualLayout: z.string().min(1),
  lineSpacing: z.number().positive(),
  backgroundBar: z.boolean().default(false),
  backgroundColor: z.string().min(1).default("#000000cc"),
  safeAreaMargin: z.number().int().nonnegative().default(32)
});

export const SubtitleLineSchema = z
  .object({
    id: z.string().min(1),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().nonnegative(),
    speakerId: z.string().nullable(),
    sourceLanguage: LanguageCodeSchema,
    targetLanguage: LanguageCodeSchema.nullable(),
    sourceText: z.string(),
    translatedText: z.string(),
    words: z.array(WordTimingSchema),
    styleOverrides: StyleOverridesSchema,
    reviewStatus: ReviewStatusSchema,
    aiOrigin: AiOriginSchema,
    translationStatus: TranslationStatusSchema.default("not_requested"),
    translationOrigin: TranslationOriginSchema.nullable().default(null),
    translationError: z.string().nullable().default(null),
    notes: z.string()
  })
  .refine((line) => line.endMs > line.startMs, {
    message: "line endMs must be greater than startMs"
  });

export const SubtitleDocumentSchema = z.object({
  schemaVersion: z.literal("diplomat.subtitle.v1"),
  projectId: z.string().min(1),
  mediaId: z.string().min(1),
  durationMs: z.number().int().nonnegative(),
  speakers: z.array(SpeakerSchema),
  styles: z.array(SubtitleStyleSchema),
  lines: z.array(SubtitleLineSchema)
});

export type SubtitleDocument = z.infer<typeof SubtitleDocumentSchema>;
export type SubtitleLine = z.infer<typeof SubtitleLineSchema>;
export type SubtitleStyle = z.infer<typeof SubtitleStyleSchema>;
export type Speaker = z.infer<typeof SpeakerSchema>;
export type TranslationStatus = z.infer<typeof TranslationStatusSchema>;
export type TranslationOrigin = z.infer<typeof TranslationOriginSchema>;
