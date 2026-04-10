# Collaborative Document Store

A production-ready wiki backend built with MongoDB, featuring Optimistic Concurrency Control (OCC), full-text search, and automated schema migrations.

## Tech Stack
- **Runtime**: Node.js (v20)
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: MongoDB 7
- **In Memory/Caching**: Incremental Revision History

## Features
- **Optimistic Concurrency Control (OCC)**: Version-based updates to prevent lost updates in collaborative editing.
- **Revision History**: Capped history of the last 20 changes with automatically generated diffs.
- **Full-Text Search**: Rich search capabilities with relevance scoring and tag filtering.
- **Automated Seeding**: Streaming Wikipedia XML parsing to bootstrap the store with 10k documents.
- **Dual Migration Strategy**:
  - **Lazy (On-Read)**: Real-time schema transformation during document retrieval.
  - **Background**: Batch processing script for bulk updates.

## Getting Started

### Prerequisites
- Docker & Docker Compose

### Building and Running
1. Clone the repository.
2. Build and start the services:
   ```bash
   docker-compose up -d --build
   ```
3. The API will be available at `http://localhost:3000`.
4. Seeding starts automatically on the first run. You can monitor progress with:
   ```bash
   docker-compose logs -f api
   ```

### API Endpoints

#### Documents
- `POST /api/documents`: Create a new document.
- `GET /api/documents/:slug`: Retrieve a document (triggers lazy migration).
- `PUT /api/documents/:slug`: Update a document (requires `version` for OCC).
- `DELETE /api/documents/:slug`: Delete a document.

#### Search & Analytics
- `GET /api/search?q=query&tags=tag1,tag2`: Search articles.
- `GET /api/analytics/most-edited`: Get top 10 most revised documents.
- `GET /api/analytics/tag-cooccurrence`: Get the most frequent tag pairs.

### Schema Migration
To run the background migration script:
```bash
docker exec collaborative_api node scripts/migrate_author_schema.js
```

## Architecture
The system uses a **Document Model** with embedded metadata and revision history to optimize for read patterns. **Optimistic Concurrency Control** is implemented via atomic `findOneAndUpdate` operations using a `version` field. The **Polymorphic Pattern** handles schema evolution, allowing for both string and object-based author fields during the migration phase.
