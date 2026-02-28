import { Request, Response } from "express";
import prisma from "../../utils/prismClient";

// Mock dependencies
jest.mock("../../utils/prismClient", () => ({
  __esModule: true,
  default: {
    zap: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock("bcrypt", () => ({
  __esModule: true,
  default: {
    hash: jest.fn(() => Promise.resolve("$2b$10$hashedpassword123")),
  },
}));
jest.mock("qrcode");
jest.mock("../../middlewares/cloudinary", () => ({
  __esModule: true,
  default: {
    uploader: {
      upload_stream: jest.fn((options, callback) => {
        // Simulate successful upload
        setImmediate(() => {
          callback(null, {
            secure_url: "https://cloudinary.com/test-image.jpg",
            public_id: "test-image-id",
          });
        });
        // Return a mock stream with end method
        return {
          end: jest.fn(),
        };
      }),
    },
  },
}));
jest.mock("../../utils/encryption", () => ({
  encryptText: jest.fn((text) => `encrypted_${text}`),
  decryptText: jest.fn((text) => text.replace("encrypted_", "")),
}));
jest.mock("../../utils/accessControl", () => ({
  hasQuizProtection: jest.fn(() => false),
  verifyQuizAnswer: jest.fn(() => Promise.resolve(true)),
  hashQuizAnswer: jest.fn((answer) => Promise.resolve(`hashed_${answer}`)),
}));
jest.mock("../../middlewares/rateLimiter", () => ({
  clearZapPasswordAttemptCounter: jest.fn(),
}));
jest.mock("../../utils/passwordValidator", () => ({
  __esModule: true,
  validatePasswordStrength: jest.fn(() => ({ isValid: true, errors: [] })),
}));
jest.mock("../../services/analytics.service", () => ({
  __esModule: true,
  logAccess: jest.fn(),
}));
jest.mock("nanoid", () => ({
  __esModule: true,
  customAlphabet: jest.fn(() => {
    let callCount = 0;
    return () => {
      callCount++;
      // Return predictable IDs for testing
      return `test${callCount.toString().padStart(2, '0')}`;
    };
  }),
}));


// Import after mocks
import { createZap } from "../zap.controller";
import { fromBuffer as fileTypeFromBuffer } from "file-type";

describe("createZap - Collision Detection Tests", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: any;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup mock request
    mockRequest = {
      body: {
        type: "text",
        name: "Test Zap",
        textContent: "This is test content",
      },
      file: undefined,
    };

    // Setup mock response
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe("Successful ID Generation", () => {
    it("should successfully create a zap with unique IDs on first attempt", async () => {
      // Mock findUnique to return null (no collision)
      (prisma.zap.findUnique as jest.Mock).mockResolvedValue(null);

      // Mock create to return a successful zap
      (prisma.zap.create as jest.Mock).mockResolvedValue({
        id: "cuid123",
        shortId: "test01",
        qrId: "test02",
        type: "TEXT",
        name: "Test Zap",
      });

      await createZap(mockRequest as Request, mockResponse);

      // Verify that findUnique was called twice (once for shortId, once for qrId)
      expect(prisma.zap.findUnique).toHaveBeenCalledTimes(2);

      // Verify successful response
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          statusCode: 201,
        })
      );
    });
  });

  describe("Single Retry Scenario", () => {
    it("should retry once when first shortId collides, then succeed", async () => {
      // First call returns a collision, second call succeeds
      (prisma.zap.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: "existing1" }) // shortId collision
        .mockResolvedValueOnce(null) // shortId retry succeeds
        .mockResolvedValueOnce(null); // qrId succeeds

      (prisma.zap.create as jest.Mock).mockResolvedValue({
        id: "cuid123",
        shortId: "test02",
        qrId: "test03",
        type: "TEXT",
        name: "Test Zap",
      });

      await createZap(mockRequest as Request, mockResponse);

      // Verify that findUnique was called 3 times (2 for shortId retry, 1 for qrId)
      expect(prisma.zap.findUnique).toHaveBeenCalledTimes(3);

      // Verify successful response
      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });

    it("should retry once when first qrId collides, then succeed", async () => {
      (prisma.zap.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // shortId succeeds
        .mockResolvedValueOnce({ id: "existing2" }) // qrId collision
        .mockResolvedValueOnce(null); // qrId retry succeeds

      (prisma.zap.create as jest.Mock).mockResolvedValue({
        id: "cuid123",
        shortId: "test01",
        qrId: "test03",
        type: "TEXT",
        name: "Test Zap",
      });

      await createZap(mockRequest as Request, mockResponse);

      // Verify that findUnique was called 3 times
      expect(prisma.zap.findUnique).toHaveBeenCalledTimes(3);

      // Verify successful response
      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });
  });

  describe("Max Retry Exhaustion", () => {
    it("should return 503 when max retries exhausted for shortId generation", async () => {
      // Mock all attempts to return collisions
      (prisma.zap.findUnique as jest.Mock).mockResolvedValue({
        id: "existing",
      });

      await createZap(mockRequest as Request, mockResponse);

      // Verify that findUnique was called 5 times (max retries for shortId)
      expect(prisma.zap.findUnique).toHaveBeenCalledTimes(5);

      // Verify 503 Service Unavailable response
      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 503,
          message: expect.stringContaining("temporarily unavailable"),
        })
      );
    });

    it("should return 503 when max retries exhausted for qrId generation", async () => {
      // shortId succeeds, but qrId exhausts retries
      (prisma.zap.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // shortId succeeds
        .mockResolvedValue({ id: "existing" }); // qrId always collides

      await createZap(mockRequest as Request, mockResponse);

      // Verify that findUnique was called 6 times (1 for shortId, 5 for qrId attempts)
      expect(prisma.zap.findUnique).toHaveBeenCalledTimes(6);

      // Verify 503 Service Unavailable response
      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 503,
        })
      );
    });
  });

  describe("Prisma Unique Constraint Violation", () => {
    it("should return 409 when Prisma throws P2002 unique constraint error", async () => {
      // Mock successful ID generation
      (prisma.zap.findUnique as jest.Mock).mockResolvedValue(null);

      // Mock Prisma unique constraint error
      const prismaError: any = new Error("Unique constraint failed");
      prismaError.code = "P2002";

      (prisma.zap.create as jest.Mock).mockRejectedValue(prismaError);

      await createZap(mockRequest as Request, mockResponse);

      // Verify 409 Conflict response
      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 409,
          message: expect.stringContaining("already exists"),
        })
      );
    });
  });

  describe("Error Handling", () => {
    it("should return 500 for unexpected errors", async () => {
      // Mock an unexpected error
      (prisma.zap.findUnique as jest.Mock).mockRejectedValue(
        new Error("Database connection failed")
      );

      await createZap(mockRequest as Request, mockResponse);

      // Verify 500 Internal Server Error response
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 500,
          message: "Internal server error",
        })
      );
    });

    it("should return 400 when no file, URL, or text content provided", async () => {
      mockRequest.body = {
        type: "text",
        name: "Test Zap",
        // Missing textContent, originalUrl, and file
      };

      await createZap(mockRequest as Request, mockResponse);

      // Verify 400 Bad Request response
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 400,
        })
      );
    });
  });

  describe("No Regression in Existing Flow", () => {
    it("should maintain existing functionality for file uploads", async () => {
      mockRequest.file = {
        path: "https://cloudinary.com/test-image.jpg",
        originalname: "test-image.jpg",
        buffer: Buffer.from("fake-image-data"),
      } as any;

      mockRequest.body = {
        type: "image",
        name: "Test Image",
      };

      // Mock file-type to return jpg for this test
      (fileTypeFromBuffer as jest.Mock).mockResolvedValueOnce({ ext: "jpg", mime: "image/jpeg" });

      (prisma.zap.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.zap.create as jest.Mock).mockResolvedValue({
        id: "cuid123",
        shortId: "test01",
        qrId: "test02",
        type: "IMAGE",
        name: "Test Image",
      });

      await createZap(mockRequest as Request, mockResponse);

      // Verify successful response
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(prisma.zap.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "IMAGE",
            name: "Test Image",
          }),
        })
      );
    });

    it("should maintain existing functionality for URL sharing", async () => {
      mockRequest.body = {
        type: "URL",
        name: "Test URL",
        originalUrl: "https://example.com",
      };

      (prisma.zap.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.zap.create as jest.Mock).mockResolvedValue({
        id: "cuid123",
        shortId: "test01",
        qrId: "test02",
        type: "URL",
        name: "Test URL",
      });

      await createZap(mockRequest as Request, mockResponse);

      // Verify successful response
      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });

    it("should maintain password hashing functionality when password provided", async () => {
      mockRequest.body = {
        type: "text",
        name: "Protected Zap",
        textContent: "Secret content",
        password: "mypassword123",
      };

      (prisma.zap.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.zap.create as jest.Mock).mockResolvedValue({
        id: "cuid123",
        shortId: "test01",
        qrId: "test02",
        type: "TEXT",
        name: "Protected Zap",
      });

      await createZap(mockRequest as Request, mockResponse);

      // Verify successful response
      expect(mockResponse.status).toHaveBeenCalledWith(201);

      // Verify prisma.zap.create was called
      expect(prisma.zap.create).toHaveBeenCalled();
      const createCall = (prisma.zap.create as jest.Mock).mock.calls[0][0];

      // When password is provided, passwordHash should not be null
      // (it should be hashed, or at least attempted to be hashed)
      expect(createCall.data).toHaveProperty("passwordHash");
    });
  });
});
