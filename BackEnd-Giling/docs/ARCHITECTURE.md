# Architecture Documentation

## System Overview

The Belanja Giling Management System is a web-based application designed to manage rice milling operations from grain purchase to product sales. The system follows a wizard-based approach for data entry and supports multi-user access with role-based permissions.

## Technology Stack

### Backend
- **Framework:** Express.js (Node.js 18)
- **Language:** JavaScript (ES6+)
- **Architecture:** MVC Pattern with Service Layer

### Database
- **Primary:** PostgreSQL 15
- **Connection Pooling:** node-pg
- **Schema:** Relational with foreign key constraints

### Storage
- **File Storage:** Cloudflare R2 (S3-compatible, planned)
- **Metadata:** PostgreSQL files table

### Infrastructure
- **Reverse Proxy:** NGINX
- **Containerization:** Docker & Docker Compose
- **Deployment:** VPS (2GB RAM minimum)

## Application Architecture

```
┌─────────────────────────────────────────────────────────┐
│                       NGINX                             │
│              (Reverse Proxy / Load Balancer)            │
└──────────────────┬──────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
┌───────▼──────────┐  ┌──────▼──────────┐
│   Express.js     │  │  Static Files   │
│   API Server     │  │   (Future)      │
│   Port 3000      │  │                 │
└───────┬──────────┘  └─────────────────┘
        │
        │ ┌─────────────────────────────────┐
        ├─►  PostgreSQL (Main Database)    │
        │ │  - Core business data          │
        │ └─────────────────────────────────┘
        │
        │ ┌─────────────────────────────────┐
        └─►  PostgreSQL (Log Database)      │
          │  - Audit trail / History       │
          └─────────────────────────────────┘
```

## Component Structure

### 1. Routes Layer
- Maps HTTP endpoints to controllers
- Applies middleware (auth, validation, logging)
- Handles routing logic

### 2. Middleware Layer
- **auth.js:** JWT verification and role-based access control
- **errorHandler.js:** Centralized error handling
- **validateRequest.js:** Joi-based input validation
- **logActivity.js:** Audit trail logging

### 3. Controllers Layer
- Handles HTTP request/response
- Calls service layer methods
- Returns formatted responses

### 4. Services Layer
- Business logic implementation
- Transaction management
- Cross-entity operations

### 5. Models Layer
- Database query abstraction
- CRUD operations
- Data access patterns

### 6. Database Layer
- PostgreSQL connection pooling
- Transaction support
- Query execution

## Data Flow

### Create Batch Flow Example

```
1. POST /api/batches
   ↓
2. Route → Middleware Chain:
   - verifyToken (authenticate)
   - requireRole (authorize)
   - validateRequest (validate input)
   - logActivity (prepare logging)
   ↓
3. Controller (batches.controller.js)
   - Extract request data
   - Call service method
   ↓
4. Service (batch.service.js)
   - Apply business rules
   - Call model methods
   ↓
5. Model (batchesModel)
   - Execute SQL query
   - Return data
   ↓
6. Database triggers (auto-update totals)
   ↓
7. Response → Controller → Client
   ↓
8. Log Activity (async, non-blocking)
```

## Security Architecture

### Authentication
- JWT-based token authentication
- Tokens expire after 7 days (configurable)
- Password hashing with bcrypt (10 rounds)

### Authorization
- Role-based access control (RBAC)
- Three roles: Admin, Operator, Viewer
- Middleware enforcement on protected routes

### Input Validation
- Joi schemas for all inputs
- SQL injection prevention via parameterized queries
- Type checking and sanitization

### HTTP Security
- Helmet.js for security headers
- CORS configuration
- Request size limits

## Database Design Principles

### Normalization
- 3rd Normal Form (3NF)
- Minimal data redundancy
- Foreign key constraints

### Triggers & Automation
- Auto-calculate derived fields
- Auto-update aggregate values
- Auto-close batches when depleted

### Audit Trail
- Separate log database (optional)
- Track all CUD operations
- Store before/after state

## Business Logic

### Batch Management
1. Create batch with date
2. Add 1-8 purchases per batch
3. Track total and remaining quantities
4. Auto-close when remaining ≤ 0

### Process Management
1. Create process with 1-3 batches
2. Validate batch availability
3. Update batch remaining quantities
4. Track input/output
5. Calculate rendemen (yield percentage)

### Sales Management
1. Record sales by product type
2. Track prices and quantities
3. Auto-calculate totals
4. Quality grading

## Scalability Considerations

### Current Capacity (2GB VPS)
- ~10,000 batches/year
- ~50 concurrent users
- ~100,000 database records

### Future Scaling Options
1. **Horizontal Scaling:** Multiple API instances behind load balancer
2. **Database Optimization:** Read replicas, connection pooling
3. **Caching:** Redis for frequently accessed data
4. **CDN:** For static assets and images

## Monitoring & Observability

### Logs
- Application logs (Morgan)
- Database query logs
- Error logs with stack traces

### Health Checks
- `/health` endpoint
- Database connectivity check
- Service status

### Audit Trail
- User actions logged to log_history table
- IP address and user agent tracking
- Old/new data comparison

## Deployment Strategy

### Docker Compose
- Multi-container setup
- Service dependencies
- Volume persistence
- Network isolation

### Environment Management
- `.env` files for configuration
- Separate configs per environment
- Secret management

## Future Enhancements

1. **File Upload:** Cloudflare R2 integration
2. **Wizard UI:** React-based frontend
3. **Real-time Updates:** WebSocket support
4. **Reporting:** PDF generation, analytics
5. **Backup Automation:** Scheduled backups
6. **Notifications:** Email/SMS alerts
7. **Mobile App:** React Native application
