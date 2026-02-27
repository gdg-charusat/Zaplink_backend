# ZapLink API - Postman Collection

This directory contains the Postman collection and environments for testing the ZapLink API.

## Files

- **postman_collection.json** - Complete API collection with all endpoints
- **postman_environment_local.json** - Environment variables for local development
- **postman_environment_production.json** - Environment variables for production

## Quick Start

### 1. Import into Postman

1. Open Postman
2. Click **Import** button (top left)
3. Select **File** tab
4. Choose the `postman_collection.json` file
5. Click **Import**

### 2. Import Environment

1. Click the **Environments** icon (left sidebar)
2. Click **Import** 
3. Select `postman_environment_local.json`
4. Click **Import**
5. Select the "ZapLink Local Development" environment from the dropdown (top right)

### 3. Run Database Seed

Before testing with the pre-configured requests, seed your database:

```bash
npm run seed
```

This will populate your database with sample data that matches the Postman collection variables.

### 4. Start the Server

```bash
npm run dev
```

The server will start at `http://localhost:3000`

### 5. Test API Endpoints

Now you can test all the pre-configured requests in the collection!

## Collection Structure

### Health Check
- **Root Endpoint** - Check if API is running
- **Health Check** - Server health status

### Zaps
All file sharing and URL shortening endpoints:

#### Create Requests
- **Create Zap - File Upload (PDF)** - Upload a PDF file
- **Create Zap - File Upload (Image)** - Upload an image
- **Create Zap - Password Protected** - Create password-protected Zap
- **Create Zap - Quiz Protected** - Create quiz-protected Zap
- **Create Zap - URL Shortener** - Shorten a URL
- **Create Zap - Text Content** - Share text content
- **Create Zap - With Delayed Unlock** - Schedule content unlock

#### Get Requests
- **Get Zap by Short ID (Public)** - Retrieve public Zap
- **Get Zap by Short ID (Password Protected)** - Retrieve with password
- **Get Zap by Short ID (Quiz Protected)** - Retrieve with quiz answer
- **Get Zap Metadata** - Get Zap info without content
- **Verify Quiz Answer** - Check quiz answer validity
- **Get URL Shortened Zap** - Retrieve shortened URL
- **Get Text Content Zap** - Retrieve text content
- **Get Delayed Unlock Zap** - Test delayed unlock (returns 423 if locked)

## Seed Data Mapping

The Postman collection is pre-configured to work with the seed data:

| Short ID | Type | Protection | Details |
|----------|------|------------|---------|
| `pdf-demo` | PDF | None | Public PDF, 5 views |
| `img-demo` | IMAGE | None | Public image, 23/100 views |
| `secure-doc` | WORD | Password | Password: `TestPass123!` |
| `quiz-file` | PDF | Quiz | Answer: `paris` |
| `url-short` | URL | None | GitHub repository link |
| `text-note` | TEXT | None | Text content sample |
| `video-demo` | VIDEO | None | Video sample |
| `audio-demo` | AUDIO | None | Audio sample |
| `zip-archive` | ZIP | Password | Password: `TestPass123!` |
| `ppt-demo` | PPT | None | Presentation sample |
| `delayed-unlock` | PDF | Time-locked | Unlocks in 2 days from seed |
| `expired-zap` | IMAGE | None | Already expired (for testing) |
