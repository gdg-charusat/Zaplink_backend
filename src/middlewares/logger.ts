import { Request, Response, NextFunction } from "express";

/**
 * Middleware to log incoming API requests and their corresponding responses.
 * Logs HTTP Method, Endpoint URL, Request timestamp, Response status code,
 * Response time (ms), and Client IP.
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    // Listen to the 'finish' event to calculate response time and log details
    res.on("finish", () => {
        const responseTime = Date.now() - startTime;

        // Attempt to extract client IP from headers or socket
        const clientIp = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || req.ip || "Unknown IP") as string;

        // Format: [Timestamp] METHOD /url | Status: 200 | Time: 45ms | IP: 127.0.0.1
        console.log(
            `[${timestamp}] ${req.method} ${req.originalUrl} | Status: ${res.statusCode} | Time: ${responseTime}ms | IP: ${clientIp}`
        );
    });

    next();
};
