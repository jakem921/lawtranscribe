# Supabase Migration Guide

## Table of Contents
1. [Current Architecture](#current-architecture)
2. [Migration Strategy](#migration-strategy)
3. [Step-by-Step Migration](#step-by-step-migration)
4. [Code Changes](#code-changes)
5. [Testing Strategy](#testing-strategy)
6. [Rollback Plan](#rollback-plan)
7. [Post-Migration Tasks](#post-migration-tasks)

## Current Architecture

### Database Structure
- **Provider**: SQLite via Prisma ORM
- **Main Models**:
  - Meeting
  - Task
  - Decision
  - Question
  - Insight
  - Deadline
  - Attendee
  - FollowUp
  - Risk
  - Agenda

### Key Features
- CRUD operations through Prisma Client
- Transaction support for complex operations
- Foreign key relationships between models
- Timestamp handling for creation and updates

## Migration Strategy

### Phase 1: Preparation
1. **Create Supabase Project**
   - Sign up for Supabase
   - Create new project
   - Note down connection details
   - Enable required extensions

2. **Environment Setup**
   ```env
   # Current
   DATABASE_URL="file:./dev.db"
   
   # New (to be added)
   DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-ID].supabase.co:5432/postgres"
   ```

3. **Backup Current Data**
   ```bash
   # Create SQLite backup
   cp ./dev.db ./backup/dev.db.backup
   
   # Export schema
   npx prisma db pull > ./backup/schema.sql
   ```

### Phase 2: Schema Migration

1. **Update Prisma Schema**
   ```prisma
   // Update datasource in schema.prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   
   // Models remain unchanged
   model Meeting {
     // ... existing fields
   }
   ```

2. **Generate Migration**
   ```bash
   npx prisma migrate reset
   npx prisma generate
   ```

## Step-by-Step Migration

### 1. Development Environment Setup
```bash
# Create new branch
git checkout -b feature/supabase-migration

# Install dependencies
npm install @supabase/supabase-js

# Create test database
npx prisma migrate reset --preview-feature
```

### 2. Data Migration
```bash
# Export data
npx prisma db export --format sql > ./backup/data.sql

# Transform data if needed
# Use provided migration scripts

# Import to Supabase
psql [YOUR-SUPABASE-URL] < ./backup/data.sql
```

### 3. Connection Management
```typescript
// lib/prisma.ts
const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: ['query'],
        datasources: {
            db: {
                url: process.env.DATABASE_URL
            }
        }
    })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

## Code Changes

### 1. API Routes
No changes needed for basic CRUD operations:

```typescript
// app/api/meetings/route.ts remains unchanged
export async function GET() {
    const meetings = await prisma.meeting.findMany()
    return NextResponse.json(meetings)
}
```

### 2. Transaction Handling
Transactions continue to work the same way:

```typescript
// Example from your delete operation
await prisma.$transaction([
    prisma.task.deleteMany({ where: { meetingId: id } }),
    prisma.decision.deleteMany({ where: { meetingId: id } }),
    // ... other deletes
])
```

### 3. DateTime Handling
PostgreSQL has more precise timestamp handling but requires no code changes:

```typescript
model Meeting {
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
}
```

## Testing Strategy

### 1. Local Testing
```bash
# Create test database
npx prisma migrate reset

# Run test suite
npm run test

# Manual testing checklist:
# - CRUD operations
# - File uploads
# - Transcription service
# - Chat functionality
# - Export features
```

### 2. Staging Environment
- Deploy to staging environment
- Test with production-like data
- Verify all integrations
- Load testing with multiple users

### 3. Performance Testing
- Test concurrent operations
- Verify connection pooling
- Monitor query performance
- Check real-time features

## Rollback Plan

### Quick Rollback
```bash
# Revert environment variables
mv .env.backup .env

# Restore SQLite database
cp ./backup/dev.db.backup ./dev.db

# Revert Prisma schema
git checkout origin/main -- prisma/schema.prisma
```

### Full Rollback
1. Keep Supabase project as backup
2. Maintain SQLite backup for 30 days
3. Document all changes for easy reversal

## Post-Migration Tasks

### 1. Performance Monitoring
- Set up Supabase monitoring
- Configure error tracking
- Monitor database metrics

### 2. Security
- Review connection security
- Set up row-level security
- Configure backup strategy

### 3. Documentation
- Update API documentation
- Document new features
- Update deployment guides

### 4. Optimization
- Index frequently queried fields
- Optimize query patterns
- Configure connection pooling

## Benefits of Migration

### 1. Scalability
- Better concurrent operation handling
- Built-in connection pooling
- Automatic backups
- Horizontal scaling capability

### 2. Features
- Real-time subscriptions
- Row-level security
- Built-in authentication
- Better indexing capabilities

### 3. Development
- Better development experience
- More robust type safety
- Improved query performance
- Better debugging tools

## Potential Challenges

### 1. Performance
- Monitor query performance
- Optimize indexes
- Configure connection pools
- Watch for N+1 queries

### 2. Security
- Secure connection strings
- Configure RLS policies
- Manage access control
- Set up audit logging

### 3. Data Integrity
- Validate all migrations
- Check foreign key constraints
- Verify data types
- Test all relationships

## Support

For issues during migration:
1. Consult Supabase documentation
2. Check Prisma migration guides
3. Review error logs
4. Contact support if needed 