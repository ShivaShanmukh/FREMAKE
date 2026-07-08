import { z } from "zod";

/**
 * The model returns SEMANTIC content only — element types and labels, no
 * pixel coordinates. Layout is computed deterministically in
 * src/lib/wireframe/layout.ts. This keeps the model output small (token
 * yield) and the rendering reliable.
 */

export const ELEMENT_TYPES = [
  "header",
  "text",
  "button",
  "input",
  "image",
  "list",
  "nav",
] as const;

export const wireframeElementSchema = z.object({
  type: z.enum(ELEMENT_TYPES),
  label: z.string().min(1),
});

export const screenSchema = z.object({
  name: z.string().min(1),
  purpose: z.string().min(1),
  elements: z.array(wireframeElementSchema).min(3).max(12),
});

export const personaSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  goal: z.string().min(1),
  painPoint: z.string().min(1),
});

export const iaSectionSchema = z.object({
  section: z.string().min(1),
  items: z.array(z.string().min(1)).min(1),
});

export const generationResultSchema = z.object({
  personas: z.array(personaSchema).min(2).max(4),
  informationArchitecture: z.array(iaSectionSchema).min(1),
  screens: z.array(screenSchema).length(5),
});

export type WireframeElement = z.infer<typeof wireframeElementSchema>;
export type Screen = z.infer<typeof screenSchema>;
export type Persona = z.infer<typeof personaSchema>;
export type IASection = z.infer<typeof iaSectionSchema>;
export type GenerationResult = z.infer<typeof generationResultSchema>;
