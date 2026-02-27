import { z } from "zod";

// Shared schemas
const shortIdSchema = z.string().min(1, "shortId is required");

// POST /api/zaps/upload
export const createZapSchema = z.object({
    body: z.object({
        type: z.enum([
            "pdf",
            "image",
            "video",
            "audio",
            "archive",
            "url",
            "text",
            "document",
            "presentation",
            "spreadsheet",
        ], { message: "Invalid type provided" }).optional(),
        name: z.string().optional(),
        originalUrl: z.string().url("Invalid original URL").optional(),
        textContent: z.string().optional(),
        password: z.string().optional(),
        viewLimit: z
            .string()
            .optional()
            .refine((val) => {
                if (!val) return true;
                const num = parseInt(val, 10);
                return !isNaN(num) && num >= 1;
            }, { message: "viewLimit must be a positive integer." }),
        expiresAt: z
            .string()
            .refine(
                (val) => {
                    if (!val) return true;
                    const date = new Date(val);
                    return !isNaN(date.getTime()) && date.getTime() > Date.now();
                },
                { message: "expiresAt must be a valid future datetime." }
            )
            .optional(),
        quizQuestion: z.string().optional(),
        quizAnswer: z.string().optional(),
        delayedAccessTime: z
            .string()
            .refine((val) => {
                if (!val) return true;
                const num = parseInt(val, 10);
                return !isNaN(num) && num >= 0;
            }, { message: "delayedAccessTime must be a non-negative integer." })
            .optional(),
    }),
});

// GET /api/zaps/:shortId/metadata
export const getZapMetadataSchema = z.object({
    params: z.object({
        shortId: shortIdSchema,
    }),
});

// POST /api/zaps/:shortId/verify-quiz
export const verifyQuizForZapSchema = z.object({
    params: z.object({
        shortId: shortIdSchema,
    }),
    body: z.object({
        answer: z.string().min(1, "answer is required"),
    }),
});

// GET /api/zaps/:shortId
export const getZapByShortIdSchema = z.object({
    params: z.object({
        shortId: shortIdSchema,
    }),
    query: z.object({
        password: z.string().optional(),
        quizAnswer: z.string().optional(),
    }),
});
