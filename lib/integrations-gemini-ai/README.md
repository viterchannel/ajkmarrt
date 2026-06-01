# @workspace/integrations-gemini-ai

Thin wrapper around the Google Gemini AI SDK for use across AJKMart services. Provides a pre-configured client, image generation helpers, and a batch-processing utility with rate-limit handling.

## What It Exports

- `ai` — pre-configured `@google/genai` client instance
- `generateImage(prompt, options?)` — generates an image via Gemini image model
- `batchProcess(items, handler, options?)` — processes items in batches with automatic retry on rate-limit errors
- `batchProcessWithSSE(items, handler, onProgress, options?)` — batch processing with Server-Sent Events progress streaming
- `isRateLimitError(error)` — type guard for Gemini rate-limit errors
- `BatchOptions` type

## Usage

```typescript
import { ai, generateImage, batchProcess } from "@workspace/integrations-gemini-ai";

// Direct Gemini API call:
const result = await ai.models.generateContent({ model: "gemini-2.0-flash", contents: "Hello" });

// Image generation:
const image = await generateImage("A scenic view of Muzaffarabad");

// Batch processing with rate-limit safety:
await batchProcess(productIds, async (id) => { /* ... */ });
```

## Required Environment Variables

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio API key |
