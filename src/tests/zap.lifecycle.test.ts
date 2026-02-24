/**
 * Integration tests for Zap lifecycle endpoints.
 *
 * Enforced Test DB Isolation:
 * - Truncates "Zap" table before EACH test.
 * - Uses dedicated test database via .env.test.
 */

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../index";
import prisma from "../utils/prismClient";

/* ── Database Isolation ────────────────────────────────────────────────── */
beforeEach(async () => {
    // Deterministic truncation derived from prisma/schema.prisma
    // model Zap -> table "Zap"
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Zap" CASCADE;`);
});

afterAll(async () => {
    await prisma.$disconnect();
});

/** Extracts the shortId from a shortUrl like ".../zaps/ABC12345" */
function extractShortId(shortUrl: string): string {
    return shortUrl.split("/").pop()!;
}

/* ════════════════════════════════════════════════════════════════════════
   POST /api/zaps/upload
   ════════════════════════════════════════════════════════════════════════ */

describe("POST /api/zaps/upload", () => {
    it("creates a URL zap — returns 201 with zapId, shortUrl, qrCode", async () => {
        const res = await request(app)
            .post("/api/zaps/upload")
            .field("type", "url")
            .field("name", "Integration Test URL")
            .field("originalUrl", "https://example.com");

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.statusCode).toBe(201);
        expect(res.body.message).toBe("Zap created successfully.");
        expect(res.body.data).toHaveProperty("zapId");
        expect(res.body.data).toHaveProperty("shortUrl");
        expect(res.body.data).toHaveProperty("qrCode");
        expect(res.body.data.type).toBe("url");
        expect(res.body.data.hasQuizProtection).toBe(false);
        expect(res.body.data.hasDelayedAccess).toBe(false);
    });

    it("creates a text zap — returns 201", async () => {
        const res = await request(app)
            .post("/api/zaps/upload")
            .field("type", "text")
            .field("name", "Integration Test Text")
            .field("textContent", "Hello from integration test.");

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe("Zap created successfully.");
        expect(res.body.data).toHaveProperty("shortUrl");
    });

    it("returns 400 when neither file, originalUrl, nor textContent is provided", async () => {
        const res = await request(app)
            .post("/api/zaps/upload")
            .field("type", "url")
            .field("name", "Empty Zap");

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe(
            "Either a file, URL, or text content must be provided."
        );
    });

    it("persists the zap in the database after creation", async () => {
        const res = await request(app)
            .post("/api/zaps/upload")
            .field("type", "url")
            .field("name", "DB Persistence Test")
            .field("originalUrl", "https://example.com");

        expect(res.status).toBe(201);

        const shortId = extractShortId(res.body.data.shortUrl);
        const dbZap = await prisma.zap.findUnique({ where: { shortId } });

        expect(dbZap).not.toBeNull();
        expect(dbZap!.name).toBe("DB Persistence Test");
        expect(dbZap!.type).toBe("URL");
        expect(dbZap!.viewCount).toBe(0);
    });
});

/* ════════════════════════════════════════════════════════════════════════
   GET /api/zaps/:shortId
   ════════════════════════════════════════════════════════════════════════ */

describe("GET /api/zaps/:shortId", () => {
    it("returns 200 with redirect data for a URL zap", async () => {
        const create = await request(app)
            .post("/api/zaps/upload")
            .field("type", "url")
            .field("originalUrl", "https://example.com");

        const shortId = extractShortId(create.body.data.shortUrl);
        const res = await request(app).get(`/api/zaps/${shortId}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("url", "https://example.com");
        expect(res.body).toHaveProperty("type", "redirect");
    });

    it("returns 200 with decrypted text content for a text zap", async () => {
        const originalText = "Decryption integration test content.";

        const create = await request(app)
            .post("/api/zaps/upload")
            .field("type", "text")
            .field("name", "Text Decrypt Test")
            .field("textContent", originalText);

        const shortId = extractShortId(create.body.data.shortUrl);
        const res = await request(app).get(`/api/zaps/${shortId}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("content", originalText);
        expect(res.body).toHaveProperty("type", "text");
        expect(res.body).toHaveProperty("name", "Text Decrypt Test");
    });

    it("returns 404 for a shortId that does not exist", async () => {
        const res = await request(app).get("/api/zaps/NOTEXIST00");

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe("Zap not found.");
    });

    it("returns 410 for an expired zap", async () => {
        const pastDate = new Date(Date.now() - 60_000).toISOString();

        const create = await request(app)
            .post("/api/zaps/upload")
            .field("type", "url")
            .field("originalUrl", "https://example.com")
            .field("expiresAt", pastDate);

        const shortId = extractShortId(create.body.data.shortUrl);
        const res = await request(app).get(`/api/zaps/${shortId}`);

        expect(res.status).toBe(410);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe("This link has expired.");
    });

    it("returns 403 after view limit is exceeded (double increment behavior)", async () => {
        const create = await request(app)
            .post("/api/zaps/upload")
            .field("type", "url")
            .field("originalUrl", "https://example.com")
            .field("viewLimit", "2");

        const shortId = extractShortId(create.body.data.shortUrl);

        // First access — increments viewCount to 2
        const first = await request(app).get(`/api/zaps/${shortId}`);
        expect(first.status).toBe(200);

        // Second access — blocked (2 >= 2)
        const second = await request(app).get(`/api/zaps/${shortId}`);
        expect(second.status).toBe(403);
        expect(second.body.success).toBe(false);
        expect(second.body.message).toBe("View limit exceeded.");
    });

    it("returns 401 when zap is password-protected and no password is given", async () => {
        const create = await request(app)
            .post("/api/zaps/upload")
            .field("type", "url")
            .field("originalUrl", "https://example.com")
            .field("password", "secret123");

        const shortId = extractShortId(create.body.data.shortUrl);
        const res = await request(app).get(`/api/zaps/${shortId}`);

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe("Password required.");
    });

    it("returns 401 when incorrect password is provided", async () => {
        const create = await request(app)
            .post("/api/zaps/upload")
            .field("type", "url")
            .field("originalUrl", "https://example.com")
            .field("password", "correctPassword");

        const shortId = extractShortId(create.body.data.shortUrl);

        const res = await request(app)
            .get(`/api/zaps/${shortId}`)
            .query({ password: "wrongPassword" });

        expect(res.status).toBe(401);
        expect(res.body.message).toBe("Incorrect password.");
    });
});

/* ════════════════════════════════════════════════════════════════════════
   GET /api/zaps/:shortId/metadata
   ════════════════════════════════════════════════════════════════════════ */

describe("GET /api/zaps/:shortId/metadata", () => {
    it("returns 200 with correct metadata for a plain URL zap", async () => {
        const create = await request(app)
            .post("/api/zaps/upload")
            .field("type", "url")
            .field("name", "Metadata Endpoint Test")
            .field("originalUrl", "https://example.com");

        const shortId = extractShortId(create.body.data.shortUrl);
        const res = await request(app).get(`/api/zaps/${shortId}/metadata`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toMatchObject({
            name: "Metadata Endpoint Test",
            type: "URL",
            hasPasswordProtection: false,
            hasQuizProtection: false,
            hasDelayedAccess: false,
            isDelayedLocked: false,
            viewsRemaining: null,
        });
    });

    it("returns 404 metadata for non-existent shortId", async () => {
        const res = await request(app).get("/api/zaps/NOTEXIST00/metadata");

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe("Zap not found.");
    });

    it("returns 410 metadata for expired zap", async () => {
        const pastDate = new Date(Date.now() - 60_000).toISOString();

        const create = await request(app)
            .post("/api/zaps/upload")
            .field("type", "url")
            .field("originalUrl", "https://example.com")
            .field("expiresAt", pastDate);

        const shortId = extractShortId(create.body.data.shortUrl);
        const res = await request(app).get(`/api/zaps/${shortId}/metadata`);

        expect(res.status).toBe(410);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe("This Zap has expired.");
    });

    it("reflects password protection flag in metadata", async () => {
        const create = await request(app)
            .post("/api/zaps/upload")
            .field("type", "url")
            .field("originalUrl", "https://example.com")
            .field("password", "secret");

        const shortId = extractShortId(create.body.data.shortUrl);
        const res = await request(app).get(`/api/zaps/${shortId}/metadata`);

        expect(res.status).toBe(200);
        expect(res.body.data.hasPasswordProtection).toBe(true);
    });

    it("reports correct viewsRemaining when viewLimit is set", async () => {
        const create = await request(app)
            .post("/api/zaps/upload")
            .field("type", "url")
            .field("originalUrl", "https://example.com")
            .field("viewLimit", "5");

        const shortId = extractShortId(create.body.data.shortUrl);
        const res = await request(app).get(`/api/zaps/${shortId}/metadata`);

        expect(res.status).toBe(200);
        expect(res.body.data.viewsRemaining).toBe(5);
    });
});