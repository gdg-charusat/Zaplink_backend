import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeText,
  sanitizeFileName,
  sanitizeUrl,
  sanitizeQuizInput,
  sanitizeEmail,
  isSuspiciousInput,
} from "./sanitizer";

test("sanitizeText - removes HTML and scripts", async () => {
  const input = "<script>alert('XSS')</script>Hello World";
  const result = sanitizeText(input);
  assert.equal(result, "Hello World");
  assert(!result.includes("<script>"));
});

test("sanitizeText - removes dangerous event handlers", async () => {
  const input = '<div onclick="alert(1)">Click me</div>';
  const result = sanitizeText(input);
  assert(!result.includes("onclick"));
});

test("sanitizeText - limits length to 5000 characters", async () => {
  const input = "a".repeat(10000);
  const result = sanitizeText(input);
  assert(result.length <= 5000);
});

test("sanitizeText - removes control characters", async () => {
  const input = "Hello\x00World\x1FTest";
  const result = sanitizeText(input);
  assert(!result.includes("\x00"));
  assert(!result.includes("\x1F"));
});

test("sanitizeFileName - prevents path traversal", async () => {
  const inputs = [
    "../../../etc/passwd",
    "..\\..\\windows\\system32",
    "file/../evil.txt",
  ];

  inputs.forEach((filename) => {
    const result = sanitizeFileName(filename);
    assert(!result.includes(".."));
    assert(!result.includes("/"));
    assert(!result.includes("\\"));
  });
});

test("sanitizeFileName - limits to 255 characters", async () => {
  const input = "a".repeat(500) + ".txt";
  const result = sanitizeFileName(input);
  assert(result.length <= 255);
});

test("sanitizeFileName - returns default for empty input", async () => {
  const result = sanitizeFileName("");
  assert.equal(result, "unnamed");
});

test("sanitizeUrl - blocks javascript protocol", async () => {
  const input = "javascript:alert('XSS')";
  const result = sanitizeUrl(input);
  assert.equal(result, null);
});

test("sanitizeUrl - blocks data protocol", async () => {
  const input = "data:text/html,<script>alert(1)</script>";
  const result = sanitizeUrl(input);
  assert.equal(result, null);
});

test("sanitizeUrl - blocks vbscript protocol", async () => {
  const input = "vbscript:msgbox('XSS')";
  const result = sanitizeUrl(input);
  assert.equal(result, null);
});

test("sanitizeUrl - adds https protocol if missing", async () => {
  const input = "google.com";
  const result = sanitizeUrl(input);
  assert(result?.startsWith("https://"));
});

test("sanitizeUrl - validates URL format", async () => {
  const input = "not a valid url at all";
  const result = sanitizeUrl(input);
  assert.equal(result, null);
});

test("sanitizeUrl - accepts valid http and https URLs", async () => {
  const validUrls = [
    "https://example.com",
    "http://example.com",
    "https://example.com/path?query=value",
  ];

  validUrls.forEach((url) => {
    const result = sanitizeUrl(url);
    assert(result !== null);
  });
});

test("sanitizeQuizInput - sanitizes and normalizes whitespace", async () => {
  const input = "What is   2+2?   <img src=x>";
  const result = sanitizeQuizInput(input);
  assert(result.includes("What is 2+2?"));
  assert(!result.includes("<img"));
});

test("sanitizeQuizInput - limits to 1000 characters", async () => {
  const input = "a".repeat(2000);
  const result = sanitizeQuizInput(input);
  assert(result.length <= 1000);
});

test("sanitizeEmail - validates email format", async () => {
  const validEmails = [
    "user@example.com",
    "test.user@example.co.uk",
    "user+tag@example.com",
  ];

  validEmails.forEach((email) => {
    const result = sanitizeEmail(email);
    assert(result !== null);
  });
});

test("sanitizeEmail - rejects invalid formats", async () => {
  const invalidEmails = [
    "not-an-email",
    "missing@domain",
    "@example.com",
    "user@",
    "user @example.com",
  ];

  invalidEmails.forEach((email) => {
    const result = sanitizeEmail(email);
    assert.equal(result, null);
  });
});

test("sanitizeEmail - converts to lowercase", async () => {
  const input = "User@Example.COM";
  const result = sanitizeEmail(input);
  assert.equal(result, "user@example.com");
});

test("isSuspiciousInput - detects script tags", async () => {
  const inputs = [
    "<script>alert(1)</script>",
    "<SCRIPT>alert(1)</SCRIPT>",
    "<ScRiPt>alert(1)</sCrIpT>",
  ];

  inputs.forEach((input) => {
    assert(isSuspiciousInput(input) === true);
  });
});

test("isSuspiciousInput - detects javascript protocol", async () => {
  const input = "javascript:alert('test')";
  assert(isSuspiciousInput(input) === true);
});

test("isSuspiciousInput - detects event handlers", async () => {
  const inputs = [
    'onclick="alert(1)"',
    'onerror=alert(1)',
    "onload='alert(1)'",
    "onmouseover=alert(1)",
  ];

  inputs.forEach((input) => {
    assert(isSuspiciousInput(input) === true);
  });
});

test("isSuspiciousInput - detects eval calls", async () => {
  const input = "eval(someCode)";
  assert(isSuspiciousInput(input) === true);
});

test("isSuspiciousInput - detects expression calls", async () => {
  const input = "expression(alert(1))";
  assert(isSuspiciousInput(input) === true);
});

test("isSuspiciousInput - detects vbscript protocol", async () => {
  const input = "vbscript:alert('test')";
  assert(isSuspiciousInput(input) === true);
});

test("isSuspiciousInput - detects data URLs", async () => {
  const input = "data:text/html,<script>alert(1)</script>";
  assert(isSuspiciousInput(input) === true);
});

test("isSuspiciousInput - allows safe input", async () => {
  const inputs = ["Hello World", "user@example.com", "https://example.com"];

  inputs.forEach((input) => {
    assert(isSuspiciousInput(input) === false);
  });
});

test("isSuspiciousInput - is case insensitive", async () => {
  const inputs = [
    "<SCRIPT>alert(1)</SCRIPT>",
    "JAVASCRIPT:alert(1)",
    "OnClick=alert(1)",
  ];

  inputs.forEach((input) => {
    assert(isSuspiciousInput(input) === true);
  });
});

test("Comprehensive XSS prevention test", async () => {
  const xssPayloads = [
    "<img src=x onerror='alert(1)'>",
    "<svg onload='alert(1)'>",
    "<body onload='alert(1)'>",
    "<iframe src='javascript:alert(1)'>",
    "<input onfocus='alert(1)' autofocus>",
    "<marquee onstart='alert(1)'>",
    "<div style='background:url(javascript:alert(1))'>",
    "<math><mi//xlink:href='data:x,<script>alert(1)</script>'>",
  ];

  xssPayloads.forEach((payload) => {
    const isSuspicious = isSuspiciousInput(payload);
    const sanitized = sanitizeText(payload);
    assert(
      isSuspicious || !sanitized.includes("<"),
      `Failed to detect/sanitize: ${payload}`,
    );
  });
});

test("Comprehensive path traversal prevention test", async () => {
  const pathTraversalPayloads = [
    "../../../etc/passwd",
    "..\\..\\..\\windows\\system32",
    "....//....//....//etc/passwd",
    "..%2F..%2F..%2Fetc%2Fpasswd",
    "..;/..;/..;/etc/passwd",
  ];

  pathTraversalPayloads.forEach((payload) => {
    const result = sanitizeFileName(payload);
    assert(!result.includes(".."), `Failed to sanitize: ${payload}`);
    assert(!result.includes("/"), `Failed to sanitize: ${payload}`);
    assert(!result.includes("\\"), `Failed to sanitize: ${payload}`);
  });
});

test("Comprehensive URL validation test", async () => {
  const testCases = [
    // Valid URLs
    { url: "https://example.com", expected: "https://example.com" },
    { url: "http://example.com", expected: "http://example.com" },
    { url: "example.com", expected: "https://example.com" },

    // Invalid/Dangerous URLs
    { url: "javascript:void(0)", expected: null },
    { url: "data:text/html,test", expected: null },
    { url: "vbscript:msgbox('xss')", expected: null },
    { url: "file:///etc/passwd", expected: null },
  ];

  testCases.forEach(({ url, expected }) => {
    const result = sanitizeUrl(url);
    assert.equal(result, expected, `URL sanitization failed for: ${url}`);
  });
});
