import { z } from "../middlewares/validate";

const zapTypeSchema = z.enum([
  "pdf",
  "image",
  "video",
  "audio",
  "archive",
  "url",
  "text",
  "document",
  "presentation",
]);

const shortIdSchema = z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9_-]+$/);

const optionalString = (min = 1, max = 10000) =>
  z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.string().trim().min(min).max(max).optional(),
  );

const optionalPositiveInt = (min: number, max: number) =>
  z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.coerce.number().int().min(min).max(max).optional(),
  );

const optionalFutureDate = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce
    .date()
    .refine((value) => value.getTime() > Date.now(), "expiresAt must be in the future.")
    .optional(),
);

export const createZapSchema = {
  body: z.object({
    type: zapTypeSchema,
    name: optionalString(1, 255),
    originalUrl: optionalString(1, 2048),
    textContent: optionalString(1, 200000),
    password: optionalString(1, 128),
    viewLimit: optionalPositiveInt(1, 100000),
    expiresAt: optionalFutureDate,
    delayedAccessTime: optionalPositiveInt(1, 31536000),
    quizQuestion: optionalString(1, 500),
    quizAnswer: optionalString(1, 500),
  }),
};

export const shortIdParamSchema = {
  params: z.object({
    shortId: shortIdSchema,
  }),
};

export const getZapByShortIdSchema = {
  ...shortIdParamSchema,
  query: z.object({
    password: optionalString(1, 128),
    quizAnswer: optionalString(1, 1000),
  }),
};

export const verifyQuizForZapSchema = {
  ...shortIdParamSchema,
  body: z.object({
    answer: z.string().trim().min(1).max(1000),
  }),
};
