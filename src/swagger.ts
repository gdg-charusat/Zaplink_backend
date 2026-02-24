import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "ZapLink API",
      version: "1.0.0",
      description: "Instant File Sharing with Secure QR Codes & Short Links - API Documentation",
      contact: {
        name: "ZapLink Support",
        url: "https://github.com/krishnapaljadeja/ZapLink_backend",
      },
      license: {
        name: "ISC",
        url: "https://opensource.org/licenses/ISC",
      },
    },
    servers: [
      {
        url: process.env.BACKEND_URL || "http://localhost:3000",
        description: "Development server",
      },
      {
        url: "https://api.zaplink.krishnapaljadeja.com",
        description: "Production server",
      },
    ],
    components: {
      schemas: {
        Zap: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Unique identifier for the zap",
              example: "clxyz123abc",
            },
            shortId: {
              type: "string",
              description: "Short unique identifier for URL",
              example: "abc123",
            },
            qrId: {
              type: "string",
              description: "QR code identifier",
              example: "qr_abc123",
            },
            type: {
              type: "string",
              enum: ["PDF", "IMAGE", "VIDEO", "AUDIO", "ZIP", "URL", "TEXT", "WORD", "PPT", "UNIVERSAL"],
              description: "Type of content",
            },
            name: {
              type: "string",
              description: "Name of the file or content",
              example: "document.pdf",
            },
            cloudUrl: {
              type: "string",
              description: "URL to the uploaded content",
              example: "https://cloudinary.com/path/to/file",
            },
            originalUrl: {
              type: "string",
              description: "Original URL (for URL type)",
              example: "https://example.com",
            },
            viewLimit: {
              type: "integer",
              description: "Maximum number of views allowed",
              example: 10,
            },
            viewCount: {
              type: "integer",
              description: "Current view count",
              example: 3,
            },
            expiresAt: {
              type: "string",
              format: "date-time",
              description: "Expiration date and time",
              example: "2026-12-31T23:59:59Z",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Creation date and time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Last update date and time",
            },
          },
        },
        ZapResponse: {
          type: "object",
          properties: {
            statusCode: {
              type: "integer",
              example: 200,
            },
            data: {
              type: "object",
              properties: {
                zapId: {
                  type: "string",
                  example: "abc123",
                },
                shortLink: {
                  type: "string",
                  example: "https://zaplink.krishnapaljadeja.com/abc123",
                },
                qrCodeDataUrl: {
                  type: "string",
                  description: "Base64 encoded QR code image",
                },
                type: {
                  type: "string",
                  example: "PDF",
                },
                name: {
                  type: "string",
                  example: "document.pdf",
                },
                expiresAt: {
                  type: "string",
                  format: "date-time",
                },
                viewLimit: {
                  type: "integer",
                  example: 10,
                },
              },
            },
            message: {
              type: "string",
              example: "Zap created successfully",
            },
            success: {
              type: "boolean",
              example: true,
            },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            statusCode: {
              type: "integer",
              example: 400,
            },
            message: {
              type: "string",
              example: "Error message",
            },
            success: {
              type: "boolean",
              example: false,
            },
            errors: {
              type: "array",
              items: {
                type: "string",
              },
            },
          },
        },
      },
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    tags: [
      {
        name: "Zaps",
        description: "File sharing and URL shortening operations",
      },
      {
        name: "Health",
        description: "Server health and status checks",
      },
    ],
  },
  apis: ["./src/Routes/*.ts", "./src/controllers/*.ts", "./src/index.ts"],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
