import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { ApiError } from "../utils/ApiError";

export const validate =
    (schema: ZodSchema) =>
        async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            try {
                await schema.parseAsync({
                    body: req.body,
                    query: req.query,
                    params: req.params,
                });
                return next();
            } catch (error) {
                if (error instanceof ZodError) {
                    // Format the Zod errors into a readable structure
                    const formattedErrors = error.issues.map((err) => ({
                        field: err.path.join("."),
                        message: err.message,
                    }));

                    res.status(400).json(new ApiError(400, "Validation Error", formattedErrors));
                    return;
                }
                return next(error);
            }
        };
