# StratForge Growth - Deployment Guide

This guide provides step-by-step instructions for deploying StratForge Growth to production using Railway (backend), Vercel (frontend), and Google Cloud Platform for OAuth.

## Prerequisites

Before starting deployment, ensure you have:
- A GitHub account and the repository code pushed
- A Railway account (https://railway.app)
- A Vercel account (https://vercel.com)
- A Stripe account with valid API keys
- A Google Cloud Console project with OAuth 2.0 credentials configured
- All environment variables documented in your local .env files

## Phase 1: Backend Deployment to Railway

### Step 1.1: Prepare the Repository

1. Ensure all code is committed and pushed to GitHub:
   ```bash
   git status
   git add .
   git commit -m "Ready for production deployment"
   git push origin main
   ```

2. Verify requirements.txt is present and up-to-date:
   ```bash
   cd backend
   pip freeze > requirements.txt
   ```

### Step 1.2: Create Railway Project

1. Log in to Railway (https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub"
4. Authorize your GitHub account and select the StratForge Growth repository
5. Select the deployment source (main branch by default is fine)

### Step 1.3: Configure Backend Service

1. After Railway clones the repository, click on the "Backend" or main service
2. Go to the "Settings" tab and ensure the root directory is set to `backend/`
3. In the "Deployment" section, verify:
   - Builder: Docker
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Step 1.4: Set Environment Variables

In the Railway project dashboard, go to "Variables" and add the following:

```
DATABASE_URL=postgresql://... (your Supabase PostgreSQL connection string)
SECRET_KEY=<your-secret-key-min-32-chars>
ANTHROPIC_API_KEY=<your-anthropic-api-key>
STRIPE_SECRET_KEY=<your-stripe-secret-key>
STRIPE_WEBHOOK_SECRET=<your-stripe-webhook-secret>
STRIPE_SOLO_PRICE_ID=<your-stripe-price-id>
STRIPE_GROWTH_PRICE_ID=<your-stripe-price-id>
STRIPE_AGENCY_PRICE_ID=<your-stripe-price-id>
FRONTEND_URL=https://<your-vercel-domain> (set after frontend deployment)
GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<your-google-oauth-client-secret>
ENCRYPTION_KEY=<your-fernet-encryption-key> (generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
```

### Step 1.5: Deploy and Test

1. Click the "Deploy" button to start the deployment process
2. Monitor the build logs in the "Deployments" tab
3. Once deployment is complete, note your production backend URL (e.g., `https://stratforge-backend.railway.app`)
4. Test the backend health endpoint:
   ```bash
   curl https://<your-railway-url>/api/health
   ```

### Step 1.6: Run Database Migrations

1. In the Railway dashboard, go to the "Connect" tab of your database service
2. Get the DATABASE_URL connection string
3. Either:
   - SSH into your Railway deployment and run: `alembic upgrade head`
   - Or use Railway's shell to run: `python -m alembic upgrade head`

## Phase 2: Frontend Deployment to Vercel

### Step 2.1: Deploy to Vercel

1. Log in to Vercel (https://vercel.com)
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Select the project to import
5. In project settings:
   - Framework: Next.js (auto-detected)
   - Root Directory: `frontend`
   - Build Command: (leave as default)
   - Output Directory: `.next`

### Step 2.2: Set Environment Variables

In Vercel project settings, go to "Environment Variables" and add:

```
NEXT_PUBLIC_API_URL=https://<your-railway-backend-url>
```

Replace `<your-railway-backend-url>` with your actual Railway backend URL (from Phase 1.5).

### Step 2.3: Deploy

1. Click "Deploy"
2. Monitor the deployment logs
3. Once complete, note your production frontend URL (e.g., `https://stratforge-growth.vercel.app`)

### Step 2.4: Update Backend FRONTEND_URL

1. Return to your Railway dashboard
2. Update the `FRONTEND_URL` variable to your Vercel production URL
3. The deployment will automatically redeploy with the new environment variable

## Phase 3: Configure Stripe Webhooks

### Step 3.1: Update Webhook Endpoint

1. Log in to your Stripe Dashboard (https://dashboard.stripe.com)
2. Go to "Webhooks" in the left sidebar
3. Click on your existing webhook endpoint (or create a new one)
4. Update the endpoint URL to:
   ```
   https://<your-railway-backend-url>/api/webhooks/stripe
   ```
5. Ensure the webhook is listening for these events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`

## Phase 4: Configure Google OAuth

### Step 4.1: Update OAuth Redirect URI

1. Go to Google Cloud Console (https://console.cloud.google.com)
2. Select your StratForge project
3. Go to "APIs & Services" → "Credentials"
4. Find your OAuth 2.0 Client ID
5. Click edit and add an authorized redirect URI:
   ```
   https://<your-railway-backend-url>/api/email/auth/gmail/callback
   ```
6. Save the changes

### Step 4.2: Verify OAuth Scopes

Ensure your OAuth consent screen includes:
- `gmail.send` (send emails on behalf of user)
- `gmail.readonly` (read Gmail messages)

## Phase 5: Post-Deployment Verification

### Step 5.1: Test Authentication

1. Visit your Vercel frontend URL
2. Create a new account or log in with an existing one
3. Verify the authentication flow works end-to-end

### Step 5.2: Test Core Features

- [ ] Consultant profile creation and editing
- [ ] Lead management (create, view, edit, delete)
- [ ] Message generation (cold email generation)
- [ ] Outreach message creation
- [ ] Gmail account connection (Settings → Email)
- [ ] Send email via connected Gmail account
- [ ] Stripe pricing page and subscription creation
- [ ] Dashboard and analytics

### Step 5.3: Test email delivery

1. Go to Settings → Email
2. Click "Connect Gmail"
3. Complete the Google OAuth flow
4. Create a message in the Outreach section
5. Send via your connected Gmail account
6. Verify email appears in the recipient's inbox
7. Verify email appears in your Gmail Sent folder

### Step 5.4: Monitor Logs

- Railway Dashboard: Check "Logs" tab for any runtime errors
- Vercel: Check "Log" in Deployment section for any build or runtime issues

## Phase 6: Troubleshooting

### Backend won't start
- Check environment variables are all set in Railway
- Verify DATABASE_URL is correct and database is accessible
- Check the Deployment logs for specific errors

### Frontend can't connect to backend
- Verify NEXT_PUBLIC_API_URL is set correctly in Vercel
- Ensure the URL includes `https://` and has no trailing slash
- Check that Railway backend is running and accessible

### OAuth returns "redirect_uri_mismatch"
- Verify the callback URL in Google Cloud Console matches exactly: `https://<your-railway-backend-url>/api/email/auth/gmail/callback`
- Check for trailing slashes or http vs https differences

### Database migrations fail
- SSH into Railway and check if Alembic is installed: `pip list | grep alembic`
- Run migrations manually in Railway shell: `python -m alembic upgrade head`
- Check for any failed migrations: `python -m alembic current`

### Email sending fails
- Verify the connected Gmail account has "Less secure app access" enabled (if using standard OAuth)
- Check the ENCRYPTION_KEY environment variable matches what was used to encrypt tokens
- Test the Gmail API access is working in your Gmail account settings

## Phase 7: Monitoring and Maintenance

### Ongoing Checks

1. **Set up alerts:**
   - Railway: Configure uptime monitoring in the Railway project
   - Vercel: Enable deployment status notifications

2. **Monitor logs regularly:**
   - Check Railway backend logs daily for errors
   - Monitor Vercel's error tracking

3. **Database backups:**
   - If using Supabase, ensure automated backups are enabled
   - Test recovery procedures monthly

4. **Stripe webhooks:**
   - Monitor webhook delivery in Stripe Dashboard
   - Ensure no failed webhook deliveries are accumulating

## Summary Checklist

- [ ] Backend deployed to Railway with all environment variables set
- [ ] Frontend deployed to Vercel with NEXT_PUBLIC_API_URL configured
- [ ] Database migrations completed on production database
- [ ] Stripe webhook endpoint updated to production backend URL
- [ ] Google OAuth redirect URI updated in Google Cloud Console
- [ ] All core features tested end-to-end in production
- [ ] Email sending verified (Gmail OAuth working)
- [ ] Monitoring and alerts configured
- [ ] Team notified of production URL

## Support

If you encounter issues during deployment:
1. Check the troubleshooting section above
2. Review logs in Railway and Vercel dashboards
3. Verify all environment variables are set correctly
4. Ensure GitHub repository is up-to-date and pushed
5. Clear browser cache and cookies if frontend issues persist
