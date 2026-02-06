# Beaver Deployment Guide

A scheduling poll application similar to Doodle. This guide covers local development setup and production deployment.

---

## Table of Contents

1. [Local Development Setup](#local-development-setup)
2. [Environment Variables](#environment-variables)
3. [Database Setup](#database-setup)
4. [Production Deployment](#production-deployment)
5. [Post-Deployment Checklist](#post-deployment-checklist)
6. [Troubleshooting](#troubleshooting)

---

## Local Development Setup

### Prerequisites

- Node.js 18+ (recommended: 20+)
- npm or yarn
- Git

### Installation Steps

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd beaver

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env.local
# Or create .env.local manually (see Environment Variables section)

# 4. Initialize the database
npm run db:push

# 5. Start development server
npm run dev
```

The app will be available at `http://localhost:3000`

### Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Push schema changes to database |
| `npm run db:studio` | Open Drizzle Studio (database GUI) |

### Testing Email Verification Locally

In development mode, verification codes are logged to the console:
```
[DEV] Verification code for user@example.com: 123456
```

You can use this code even if email sending fails.

---

## Environment Variables

Create a `.env.local` file in the project root:

```env
# ===================
# REQUIRED FOR PRODUCTION
# ===================

# Email Service (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Security Secret (generate a random 32+ character string)
NEXTAUTH_SECRET=your-super-secret-key-minimum-32-characters

# ===================
# OPTIONAL
# ===================

# Database path (defaults to ./data/beaver.db)
DATABASE_PATH=/path/to/your/database.db

# Base URL (auto-detected on Vercel, required for other hosts)
NEXT_PUBLIC_BASE_URL=https://yourdomain.com

# Vercel auto-sets this (no need to configure)
# VERCEL_URL=your-app.vercel.app
```

### Getting a Resend API Key

1. Go to [resend.com](https://resend.com)
2. Create an account
3. Add and verify your domain (or use their test domain for development)
4. Generate an API key
5. Add it to your environment variables

### Generating NEXTAUTH_SECRET

```bash
# On Linux/Mac
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Database Setup

Beaver uses SQLite with Drizzle ORM. The database file is stored locally.

### Initial Setup

```bash
# Create/update database schema
npm run db:push
```

### Database Location

- Default: `./data/beaver.db`
- Custom: Set `DATABASE_PATH` environment variable

### Backup

Simply copy the `.db` file to back up your data:
```bash
cp ./data/beaver.db ./backups/beaver-$(date +%Y%m%d).db
```

### Database GUI

```bash
npm run db:studio
```
Opens Drizzle Studio at `https://local.drizzle.studio`

---

## Production Deployment

### Option 1: Vercel (Recommended)

Vercel provides the easiest deployment for Next.js apps.

**Steps:**

1. Push your code to GitHub/GitLab/Bitbucket

2. Go to [vercel.com](https://vercel.com) and import your repository

3. Configure environment variables in Vercel dashboard:
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL`
   - `NEXTAUTH_SECRET`

4. Deploy

**Important Notes for Vercel:**
- SQLite won't persist between deployments on Vercel's serverless functions
- For production with Vercel, consider:
  - Using [Turso](https://turso.tech) (SQLite edge database)
  - Using [PlanetScale](https://planetscale.com) (MySQL)
  - Using [Neon](https://neon.tech) (PostgreSQL)

### Option 2: VPS/Dedicated Server

For a traditional server deployment (DigitalOcean, AWS EC2, etc.):

```bash
# 1. SSH into your server
ssh user@your-server

# 2. Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Clone repository
git clone <your-repo-url>
cd beaver

# 4. Install dependencies
npm ci --production

# 5. Create environment file
nano .env.local
# Add all required environment variables

# 6. Build the application
npm run build

# 7. Initialize database
npm run db:push

# 8. Start with PM2 (process manager)
npm install -g pm2
pm2 start npm --name "beaver" -- start
pm2 save
pm2 startup
```

### Option 3: Docker

Create a `Dockerfile`:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

Add to `next.config.mjs`:
```javascript
const nextConfig = {
  output: 'standalone',
};
```

Build and run:
```bash
docker build -t beaver .
docker run -p 3000:3000 \
  -e RESEND_API_KEY=your_key \
  -e RESEND_FROM_EMAIL=noreply@domain.com \
  -e NEXTAUTH_SECRET=your_secret \
  -v ./data:/app/data \
  beaver
```

---

## Post-Deployment Checklist

### Before Going Live

- [ ] **Environment Variables**: All required variables are set
- [ ] **HTTPS**: SSL certificate is configured (required for crypto APIs)
- [ ] **Email**: Test that verification emails are being sent
- [ ] **Domain**: `RESEND_FROM_EMAIL` uses a verified domain
- [ ] **Secret**: `NEXTAUTH_SECRET` is a strong, unique value
- [ ] **Database**: Initial schema is created (`npm run db:push`)

### After Deployment

- [ ] **Create a test poll**: Verify the full flow works
- [ ] **Test email verification**: Both for poll creation and responses
- [ ] **Test on mobile**: Responsive design works correctly
- [ ] **Test admin functions**: Close, reopen, finalize polls
- [ ] **Check both languages**: Test English and Japanese

### Security Checklist

- [ ] HTTPS is enforced (redirect HTTP to HTTPS)
- [ ] Environment variables are not exposed to client
- [ ] Database file is not publicly accessible
- [ ] `NEXTAUTH_SECRET` is not the default value
- [ ] Rate limiting is working (email sends, PIN attempts)

---

## Troubleshooting

### Common Issues

#### "Email verification not working"

1. Check `RESEND_API_KEY` is valid
2. Check `RESEND_FROM_EMAIL` uses a verified domain
3. In development, check console for verification code
4. Check Resend dashboard for email logs

#### "Crypto API errors"

The app requires HTTPS for cryptographic operations:
- Local development: `localhost` is considered secure
- Production: Must use HTTPS

#### "Database errors"

```bash
# Reset database (WARNING: deletes all data)
rm ./data/beaver.db
npm run db:push
```

#### "Poll URLs not working"

Ensure your domain is correctly configured:
- Vercel: Automatic via `VERCEL_URL`
- Other hosts: Set `NEXT_PUBLIC_BASE_URL`

#### "Build fails on server"

Ensure you have enough memory:
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

### Logs

```bash
# PM2 logs
pm2 logs beaver

# Docker logs
docker logs <container-id>
```

---

## URL Structure

| URL | Description |
|-----|-------------|
| `/` | Home page (redirects to locale) |
| `/en` or `/ja` | Localized home page |
| `/[locale]/new` | Create new poll |
| `/[locale]/poll/[pollId]` | Respond to poll |
| `/[locale]/poll/[pollId]/results` | View poll results |
| `/[locale]/poll/[pollId]/confirmation` | Response confirmation |
| `/[locale]/poll/[pollId]/admin/[adminToken]` | Admin dashboard |

---

## Support

For issues and feature requests, please open an issue on the repository.
