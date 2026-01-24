# AGENTS.md - Upload Tool

> Centralized deployment controller for managing remote Linux/Windows server deployments via SSH.
> Built with Next.js 16+ (App Router), React 19, TypeScript, MySQL.

## Quick Reference

```bash
# Development
npm run dev          # Start dev server on port 4000
npm run build        # Production build
npm start            # Start production server on port 4000
npm run lint         # Run ESLint

# No test framework configured yet
```

## Project Structure

```
src/
├── app/                      # Next.js App Router
│   ├── (dashboard)/          # Authenticated routes (grouped)
│   │   ├── page.tsx          # Dashboard home
│   │   ├── deploy/           # Deployment page
│   │   ├── history/          # Deployment history
│   │   ├── config/           # Project configuration
│   │   ├── users/            # User management
│   │   └── runtime-logs/     # Real-time log viewer
│   ├── api/                  # API Routes
│   │   ├── auth/             # Authentication (login, logout, me)
│   │   ├── deploy/           # Deployment operations
│   │   ├── projects/         # Project CRUD
│   │   ├── modules/          # Module CRUD
│   │   ├── environments/     # Server environment CRUD
│   │   └── ...
│   ├── login/                # Login page
│   └── layout.tsx            # Root layout
├── components/               # React components
├── lib/                      # Core utilities
│   ├── db.ts                 # MySQL connection pool
│   ├── ssh.ts                # SSH service (ssh2 wrapper)
│   ├── auth.ts               # JWT session management
│   ├── crypto.ts             # AES encryption for credentials
│   ├── permissions.ts        # RBAC permission checks
│   └── migrations/           # Database migrations
└── middleware.ts             # Auth middleware
db/
└── schema.sql                # Database schema
uploads/                      # File storage (tmp + archive)
```

## Code Style Guidelines

### TypeScript

- **Strict mode enabled** (`tsconfig.json`)
- Use path aliases: `@/lib/...`, `@/components/...`
- Define interfaces for API responses and data structures
- Avoid `any` where possible; use proper typing for database rows
- Co-locate types with their usage or in the same file

```typescript
// Good: Interface for structured data
interface Stats {
  projectCount: number;
  moduleCount: number;
  envCount: number;
}

// Good: Typed function parameters
export async function getSession(): Promise<UserSession | null> { ... }
```

### Imports

- Use path aliases (`@/`) for internal imports
- Group imports: external packages → internal modules → types
- Named exports for utilities, default exports for React components

```typescript
// External
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

// Internal
import { SSHService } from '@/lib/ssh';
import pool from '@/lib/db';

// Types (if separate)
import type { UserSession } from '@/lib/auth';
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files (utilities) | camelCase | `db.ts`, `ssh.ts`, `crypto.ts` |
| Files (components) | PascalCase | `LogModal.tsx`, `DeploymentProvider.tsx` |
| Files (routes) | `route.ts` / `page.tsx` | `src/app/api/deploy/route.ts` |
| Variables/Functions | camelCase | `fetchStats`, `currentUserId` |
| Classes | PascalCase | `SSHService` |
| Interfaces/Types | PascalCase | `UserSession`, `SSHConfig` |
| Constants | UPPER_SNAKE_CASE | `JWT_SECRET` |

### React Components

- Use `'use client'` directive for client components
- Use functional components with hooks
- Styled JSX for component-specific styles (pattern used in dashboard)

```tsx
'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [loading, setLoading] = useState(true);
  // ...
  return (
    <div className="dashboard">
      {/* content */}
      <style jsx>{`
        .dashboard { max-width: 1200px; }
      `}</style>
    </div>
  );
}
```

### API Routes

- Use Next.js App Router conventions (`route.ts`)
- Return `NextResponse.json()` for all responses
- Include proper HTTP status codes
- Log important operations with `console.log('[Context] message')`
- Use try-catch with error logging

```typescript
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log(`[Deploy] Received request for moduleId: ${body.moduleId}`);
    
    // ... logic
    
    return NextResponse.json({ message: 'Success' });
  } catch (error: any) {
    console.error('[Deploy] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### Error Handling

- Wrap async operations in try-catch
- Log errors with context prefix: `[Deploy]`, `[Auth]`, etc.
- Return user-friendly error messages in Chinese
- Record failures to `deploy_logs` table for audit

```typescript
try {
  await ssh.connect(config);
} catch (error: any) {
  let errorMsg = error.message;
  if (error.code === 'ETIMEDOUT') {
    errorMsg = '连接服务器超时，请检查服务器 IP 和端口。';
  }
  return NextResponse.json({ error: errorMsg }, { status: 500 });
}
```

### Database Operations

- Use `mysql2/promise` with connection pool (`@/lib/db`)
- Parameterized queries for all user input
- Type query results with `any` then access properties

```typescript
import pool from '@/lib/db';

const [rows]: any = await pool.query(
  'SELECT * FROM modules WHERE project_id = ?',
  [projectId]
);
const module = rows[0];
```

### SSH Operations

- Use `SSHService` class from `@/lib/ssh`
- Always call `ssh.disconnect()` in finally block
- Decrypt passwords before use: `decrypt(env.password_encrypted)`

```typescript
const ssh = new SSHService();
try {
  await ssh.connect({ host, port, username, password });
  const result = await ssh.exec('ls -la');
  await ssh.putFile(localPath, remotePath);
} finally {
  ssh.disconnect();
}
```

## Architecture Notes

### Authentication Flow
1. JWT stored in httpOnly cookie (`session`)
2. Middleware checks auth for `/api/*` and dashboard routes
3. Session expires after 8 hours
4. Roles: `admin`, `developer`, `viewer`

### Deployment Flow
1. Upload file to local `uploads/tmp/`
2. Connect to target server via SSH
3. Backup existing file (rename with timestamp)
4. Upload new file via SFTP
5. Execute restart command
6. Log result to `deploy_logs`

### Security
- SSH credentials stored with AES-256 encryption
- Password hashing with bcrypt
- RBAC for project-level permissions

## Environment Variables

Required in `.env.local`:
```env
MYSQL_HOST=localhost
MYSQL_PORT=5836
MYSQL_USER=root
MYSQL_PASSWORD=...
MYSQL_DATABASE=upload-tool
ENCRYPTION_KEY=<32-char-string>   # AES-256 key
JWT_SECRET=<64-char-string>
UPLOAD_DIR=./uploads/tmp
STORAGE_DIR=./uploads/archive
```

## Common Patterns

### Permission Check
```typescript
import { requireDeployPermission } from '@/lib/permissions';

const user = await requireDeployPermission(req, projectId);
if (!user) {
  return NextResponse.json({ error: '权限不足' }, { status: 403 });
}
```

### Database Migration
Migrations in `src/lib/migrations/` follow naming: `001-description.ts`

### Real-time Logs
Uses Server-Sent Events (SSE) with SSH `tail -f` for log streaming.

## Do NOT

- Use `as any` or `@ts-ignore` to suppress type errors
- Commit `.env.local` or credentials
- Skip error logging in API routes
- Forget to disconnect SSH connections
- Use raw SQL without parameterization
