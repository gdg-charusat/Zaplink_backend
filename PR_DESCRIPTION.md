## Description
This PR addresses issue #104 by implementing robust integration tests for the ZAP upload flow using Supertest and Jest.

## Related Issue
Closes #104

## Type of Change
- [x] Bug fix (non-breaking change which fixes an issue)
- [x] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [x] Code refactoring
- [ ] Performance improvement
- [ ] Style/UI improvement

## Changes Made
- Added `ts-jest` and `supertest` dependencies for typed testing.
- Created robust Jest integration suites testing successful shortId creation mapping via Zod schemas.
- Verified validation rejection triggers (`400 Bad Request`) for strict required values and type formatting.
- Fixed unhandled Prisma ESM import issues inside testing using global mocking (`prismClient`, `nanoid`).
- Setup an isolated test script `npm run test:integration` cleanly.

## Testing
- [x] Tested on Desktop (Chrome/Firefox/Safari)
- [ ] Tested on Mobile (iOS/Android)
- [x] Tested valid and invalid REST payloads (via cURL/Swagger)
- [x] No console errors or warnings
- [x] Code builds successfully (`npm run test:integration`)

## Checklist
- [x] My code follows the project's code style guidelines
- [x] I have performed a self-review of my code
- [x] I have commented my code where necessary
- [x] My changes generate no new warnings
- [x] I have tested my changes thoroughly
- [x] All TypeScript types are properly defined
- [x] I have read and followed the [CONTRIBUTING.md](CONTRIBUTING.md) guidelines
