# Security Implementation Guide

This document outlines the comprehensive security measures implemented in the Scribly application to protect user data and prevent common web vulnerabilities.

## 🛡️ Security Features Implemented

### 1. Row Level Security (RLS) Policies
- **Comprehensive database-level access control** for all tables
- **User isolation** - users can only access their own data
- **Friend-based sharing** - controlled access to shared content
- **Conservative defaults** - deny access unless explicitly allowed

### 2. Input Validation & Sanitization
- **Zod schemas** for all API endpoints
- **XSS prevention** with HTML sanitization
- **Length limits** to prevent DoS attacks
- **Type safety** with TypeScript validation

### 3. Rate Limiting
- **IP-based rate limiting** for all sensitive endpoints
- **Configurable limits** per endpoint type
- **In-memory LRU cache** (production-ready for Redis upgrade)
- **Fail-open design** - continues working if rate limiter fails

### 4. Security Headers
- **Content Security Policy (CSP)** - prevents XSS attacks
- **HSTS** - enforces HTTPS connections
- **X-Frame-Options** - prevents clickjacking
- **X-Content-Type-Options** - prevents MIME sniffing
- **Referrer Policy** - controls referrer information leakage

### 5. Authentication & Authorization
- **Supabase Auth** with secure session management
- **Service role key isolation** - never exposed to client
- **JWT token validation** on all protected endpoints
- **User context verification** for all operations

## 📋 Implementation Details

### Database Security (RLS Policies)

#### Users Table
```sql
-- Users can view public profile data
-- Users can update their own profile (excluding subscription fields)
-- Prevents privilege escalation
```

#### Pages/Notes Table
```sql
-- Authors have full access to their pages
-- Friends can view pages with 'friends' visibility
-- Public pages visible to authenticated users
-- Strict ownership validation
```

#### Friends & Friend Requests
```sql
-- Users can only see their own friendships
-- Controlled friend request workflow
-- Prevents unauthorized relationship access
```

#### Feedback System
```sql
-- Authenticated users can view all feedback
-- Users can only create/edit/delete their own feedback
-- Vote system with user ownership validation
```

### API Security

#### Input Validation
All API endpoints use Zod schemas for validation:
- **Content length limits** (50KB for rich content)
- **Email format validation**
- **UUID format validation**
- **Enum value validation**
- **HTML sanitization** before storage

#### Rate Limiting Configuration
- **Authentication**: 5 attempts per 15 minutes
- **Payments**: 10 requests per minute
- **Content Creation**: 30 requests per minute
- **Feedback/Voting**: 20 requests per minute
- **Friend Requests**: 10 requests per 5 minutes
- **AI Chat**: 50 messages per minute

#### HTML Sanitization
Three levels of sanitization:
- **Basic**: Text formatting, safe links
- **Rich**: Headings, tables, images (with restrictions)
- **Minimal**: Only basic text formatting

### Security Headers

#### Content Security Policy
```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src 'self' data: https: blob:;
connect-src 'self' https://*.supabase.co https://api.stripe.com;
```

#### Additional Headers
- **HSTS**: 2-year max-age with includeSubDomains
- **X-Frame-Options**: DENY
- **X-Content-Type-Options**: nosniff
- **Referrer-Policy**: strict-origin-when-cross-origin

## 🧪 Testing & Verification

### RLS Policy Testing

Run these SQL queries in Supabase SQL Editor to test RLS policies:

#### Test User Isolation
```sql
-- Test as user A (replace with actual user ID)
SET LOCAL "request.jwt.claims" = '{"sub": "user-a-uuid"}';

-- Should return only user A's pages
SELECT * FROM pages;

-- Should fail (no access to user B's pages)
SELECT * FROM pages WHERE user_id = 'user-b-uuid';
```

#### Test Friend Access
```sql
-- Test friend can view shared pages
SET LOCAL "request.jwt.claims" = '{"sub": "friend-user-uuid"}';

-- Should return friend's shared pages
SELECT * FROM pages WHERE visibility = 'friends';
```

#### Test Feedback System
```sql
-- Test feedback access
SET LOCAL "request.jwt.claims" = '{"sub": "user-uuid"}';

-- Should return all feedback (read access)
SELECT * FROM feedback;

-- Should only allow insert with own user_id
INSERT INTO feedback (user_id, title, content) VALUES ('user-uuid', 'Test', 'Content');
```

### API Endpoint Testing

#### Authentication Test
```bash
# Test protected endpoint without auth (should return 401)
curl -X GET https://your-app.com/api/pages

# Test with valid auth token
curl -X GET https://your-app.com/api/pages \
  -H "Authorization: Bearer your-jwt-token"
```

#### Rate Limiting Test
```bash
# Test rate limiting (run multiple times quickly)
for i in {1..20}; do
  curl -X POST https://your-app.com/api/feedback \
    -H "Content-Type: application/json" \
    -d '{"title":"Test","content":"Test content"}'
done
```

#### Input Validation Test
```bash
# Test XSS prevention
curl -X POST https://your-app.com/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"title":"<script>alert(\"xss\")</script>","content":"Test"}'

# Should return sanitized content without script tags
```

### Security Headers Test
```bash
# Check security headers
curl -I https://your-app.com/

# Should include:
# Content-Security-Policy: ...
# Strict-Transport-Security: ...
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
```

## 🔧 Environment Variables

### Required Variables
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # NEVER expose to client!

# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...      # NEVER expose to client!
STRIPE_WEBHOOK_SECRET=whsec_...    # NEVER expose to client!
```

### Optional Variables
```bash
# AI Features
OPENAI_API_KEY=sk-...              # NEVER expose to client!

# Monitoring
SENTRY_DSN=https://...@sentry.io/...

# Application
NEXT_PUBLIC_APP_URL=https://your-app.com
```

### Environment Validation
Run the environment validation script:
```bash
# Check all environment variables
npm run check:env

# Generate .env template
npm run check:env:template

# Check for vulnerabilities
npm run check:vuln
```

## 🚨 Security Checklist

### Before Deployment
- [ ] Run `npm run check:env` to validate environment variables
- [ ] Run `npm run check:vuln` to check for vulnerabilities
- [ ] Test RLS policies with different user contexts
- [ ] Verify rate limiting is working on sensitive endpoints
- [ ] Check that security headers are present
- [ ] Ensure no secrets are exposed in client-side code
- [ ] Test input validation and sanitization
- [ ] Verify webhook signature validation

### Production Monitoring
- [ ] Set up error monitoring (Sentry recommended)
- [ ] Monitor rate limit violations
- [ ] Track authentication failures
- [ ] Monitor CSP violations
- [ ] Regular security audits
- [ ] Keep dependencies updated

## 🔄 Rollback Instructions

### Disable RLS Policies
```sql
-- Emergency rollback - disable all RLS
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE pages DISABLE ROW LEVEL SECURITY;
ALTER TABLE notebooks DISABLE ROW LEVEL SECURITY;
ALTER TABLE sections DISABLE ROW LEVEL SECURITY;
ALTER TABLE friends DISABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE feedback DISABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_votes DISABLE ROW LEVEL SECURITY;
```

### Disable Rate Limiting
Comment out rate limiting in `middleware.ts`:
```typescript
// Temporarily disable rate limiting
// const rateLimitResult = await applyRateLimit(request, pathname);
// if (rateLimitResult) {
//   return rateLimitResult;
// }
```

### Disable Security Headers
Comment out security headers in `middleware.ts`:
```typescript
// Temporarily disable security headers
// addSecurityHeaders(response);
```

## 📚 Additional Recommendations

### Production Upgrades
1. **Distributed Rate Limiting**: Replace in-memory cache with Redis/Upstash
2. **WAF**: Add Web Application Firewall (Cloudflare, AWS WAF)
3. **DDoS Protection**: Use CDN with DDoS protection
4. **Security Scanning**: Implement automated security scanning
5. **Penetration Testing**: Regular security assessments

### Monitoring & Alerting
1. **Error Tracking**: Sentry or similar service
2. **Log Aggregation**: Structured logging with search capabilities
3. **Security Alerts**: Monitor for suspicious activities
4. **Performance Monitoring**: Track API response times and errors

### Compliance
1. **GDPR**: Implement data export/deletion capabilities
2. **SOC 2**: Consider compliance requirements for enterprise customers
3. **Privacy Policy**: Keep updated with data handling practices
4. **Terms of Service**: Include security-related terms

## 🆘 Incident Response

### Security Incident Checklist
1. **Immediate Response**
   - Identify and contain the threat
   - Preserve evidence and logs
   - Notify stakeholders

2. **Investigation**
   - Analyze attack vectors
   - Assess data exposure
   - Document findings

3. **Recovery**
   - Apply security patches
   - Reset compromised credentials
   - Restore from clean backups if needed

4. **Post-Incident**
   - Update security measures
   - Improve monitoring
   - Conduct security review

### Emergency Contacts
- **Security Team**: [Your security contact]
- **Infrastructure Team**: [Your infrastructure contact]
- **Legal/Compliance**: [Your legal contact]

---

**Last Updated**: [Current Date]
**Version**: 1.0
**Maintained By**: Security Team