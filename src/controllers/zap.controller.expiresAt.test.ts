import test from "node:test";
import assert from "node:assert/strict";
import type { Request } from "express";
import prisma from "../utils/prismClient";
import { createZap } from "./zap.controller";

type MockResponse = {
  statusCode: number;
  body: any;
  status: (code: number) => MockResponse;
  json: (payload: any) => MockResponse;
};

const createMockResponse = (): MockResponse => {
  const response: MockResponse = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };

  return response;
};

test("createZap rejects invalid date format for expiresAt", async () => {
  const createSpy = { calls: 0 };
  const originalCreate = prisma.zap.create;
  (prisma.zap.create as any) = async () => {
    createSpy.calls += 1;
    throw new Error("Should not be called");
  };

  try {
    const req = {
      body: {
        type: "url",
        name: "Invalid Date",
        originalUrl: "https://example.com",
        expiresAt: "not-a-date",
      },
      file: undefined,
    } as Request;

    const res = createMockResponse();

    await createZap(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, "Invalid expiresAt format.");
    assert.equal(createSpy.calls, 0);
  } finally {
    (prisma.zap.create as any) = originalCreate;
  }
});

test("createZap rejects non-parsable expiresAt value", async () => {
  const createSpy = { calls: 0 };
  const originalCreate = prisma.zap.create;
  (prisma.zap.create as any) = async () => {
    createSpy.calls += 1;
    throw new Error("Should not be called");
  };

  try {
    const req = {
      body: {
        type: "url",
        name: "Non Parsable",
        originalUrl: "https://example.com",
        expiresAt: {},
      },
      file: undefined,
    } as unknown as Request;

    const res = createMockResponse();

    await createZap(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, "Invalid expiresAt format.");
    assert.equal(createSpy.calls, 0);
  } finally {
    (prisma.zap.create as any) = originalCreate;
  }
});

test("createZap rejects past expiresAt timestamp", async () => {
  const createSpy = { calls: 0 };
  const originalCreate = prisma.zap.create;
  (prisma.zap.create as any) = async () => {
    createSpy.calls += 1;
    throw new Error("Should not be called");
  };

  try {
    const req = {
      body: {
        type: "url",
        name: "Past Date",
        originalUrl: "https://example.com",
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      },
      file: undefined,
    } as Request;

    const res = createMockResponse();

    await createZap(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, "expiresAt must be a future timestamp.");
    assert.equal(createSpy.calls, 0);
  } finally {
    (prisma.zap.create as any) = originalCreate;
  }
});

test("createZap accepts future expiresAt timestamp", async () => {
  const originalCreate = prisma.zap.create;
  let receivedExpiresAt: any = null;

  (prisma.zap.create as any) = async (args: any) => {
    receivedExpiresAt = args.data.expiresAt;
    return {
      id: "zap-db-id",
      shortId: args.data.shortId,
    };
  };

  try {
    const req = {
      body: {
        type: "url",
        name: "Future Date",
        originalUrl: "https://example.com",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      file: undefined,
    } as Request;

    const res = createMockResponse();

    await createZap(req, res);

    assert.equal(res.statusCode, 201);
    assert.ok(receivedExpiresAt instanceof Date);
    assert.ok(receivedExpiresAt.getTime() > Date.now());
  } finally {
    (prisma.zap.create as any) = originalCreate;
  }
});
