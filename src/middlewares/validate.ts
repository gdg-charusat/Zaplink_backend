import { Request, Response, NextFunction } from "express";
import { z, ZodError, ZodTypeAny } from "zod";
import { ApiError } from "../utils/ApiError";

type ValidationSchema = {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
};

const formatValidationErrors = (error: ZodError) =>
  error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));

export const validateRequest = (schema: ValidationSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const sections: Array<keyof ValidationSchema> = ["params", "query", "body"];

    for (const section of sections) {
      const sectionSchema = schema[section];
      if (!sectionSchema) {
        continue;
      }

      const parsed = sectionSchema.safeParse(req[section as keyof Request]);
      if (!parsed.success) {
        res
          .status(400)
          .json(new ApiError(400, "Validation failed.", formatValidationErrors(parsed.error)));
        return;
      }

      (req as any)[section] = parsed.data;
    }

    next();
  };

export { z };
