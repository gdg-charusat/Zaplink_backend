# ZapLink API Documentation

## Swagger/OpenAPI Documentation

The ZapLink API now includes comprehensive Swagger/OpenAPI documentation with an interactive UI.

### Accessing the Documentation

Once the server is running, you can access the interactive API documentation at:

**Local Development:** `http://localhost:3000/api-docs`

**Production:** `https://api.zaplink.krishnapaljadeja.com/api-docs`

### Features

- **Interactive API Testing**: Test all endpoints directly from the browser
- **Request/Response Examples**: View sample requests and responses for each endpoint
- **Schema Documentation**: Detailed information about data models and types
- **Authentication Support**: Document authentication requirements for protected endpoints
- **Parameter Descriptions**: Clear descriptions for all query, path, and body parameters

### API Endpoints

#### Health Check
- `GET /` - API root endpoint
- `GET /health` - Server health check

#### Zaps (File Sharing)
- `POST /api/zaps/upload` - Upload a file and create a new Zap
  - Supports file uploads, URL shortening, and text sharing
  - Optional password protection
  - Optional view limits and expiration dates
  
- `GET /api/zaps/:shortId` - Retrieve a Zap by its short ID
  - Password protection support
  - View count tracking
  - Automatic expiration handling

### Using the Swagger UI

1. **Start your server**:
   ```bash
   npm run dev
   ```

2. **Open your browser** and navigate to `http://localhost:3000/api-docs`

3. **Explore endpoints**: Click on any endpoint to expand its documentation

4. **Try it out**:
   - Click the "Try it out" button
   - Fill in the required parameters
   - Click "Execute" to send the request
   - View the response below

### Example Usage

#### Creating a Zap with File Upload

```bash
curl -X POST "http://localhost:3000/api/zaps/upload" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/your/file.pdf" \
  -F "type=pdf" \
  -F "name=My Document" \
  -F "viewLimit=10" \
  -F "password=secret123"
```

#### Getting a Zap

```bash
curl -X GET "http://localhost:3000/api/zaps/abc123?password=secret123"
```

### OpenAPI Specification

The OpenAPI specification is automatically generated and available at the `/api-docs` endpoint in JSON format.

### Customization

The Swagger configuration can be customized in `src/swagger.ts`. You can:
- Add more API endpoints
- Update schemas and models
- Configure authentication
- Add custom tags and descriptions
- Modify server URLs

### Benefits

- **Developer Friendly**: Easy to understand and test API endpoints
- **Standardized Documentation**: Follows OpenAPI 3.0 specification
- **Always Up-to-Date**: Documentation lives with the code
- **Interactive Testing**: No need for external tools like Postman for quick tests
- **Type Safety**: Integrated with TypeScript for better development experience
