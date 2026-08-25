# ACOP Deployment Guide

## Prerequisites
- GitHub account with repo: https://github.com/Shantali001/ACOP
- Render account (free): https://render.com
- Vercel account (free): https://vercel.com
- Supabase project with PostgreSQL database

## Step 1: Deploy Backend to Render

1. Go to https://render.com and sign up/login
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account and select the `ACOP` repository
4. Configure:
   - **Name**: `acop-backend`
   - **Environment**: `Node`
   - **Build Command**: `cd backend && npm install && npm run build`
   - **Start Command**: `cd backend && node dist/server.js`
   - **Plan**: Free
5. Add these environment variables:
   ```
   NODE_ENV=production
   PORT=4000
   DATABASE_URL=<your-supabase-postgres-url>
   DATABASE_SSL=false
   JWT_SECRET=<generate-a-secure-random-string>
   JWT_EXPIRES_IN_SECONDS=3600
   FRONTEND_ORIGIN=https://your-vercel-app.vercel.app
   VERIFY_DB_ON_STARTUP=true
   MODEM_DRIVER=serial
   ```
6. Click **"Create Web Service"**
7. Wait for deployment to complete (~2-3 minutes)
8. Copy the Render URL (e.g., `https://acop-backend.onrender.com`)

## Step 2: Deploy Frontend to Vercel

1. Go to https://vercel.com and sign up/login
2. Click **"Add New..."** → **"Project"**
3. Import your `ACOP` repository
4. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Add these environment variables:
   ```
   VITE_API_BASE_URL=https://your-render-backend.onrender.com
   VITE_SUPABASE_URL=https://yvvxenphsotorklcsfpk.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_EYs9Mu0_NQS8_jQgKaxYkQ_4N5lwl2C
   ```
6. Click **"Deploy"**
7. Wait for deployment (~1-2 minutes)
8. Copy the Vercel URL (e.g., `https://acop.vercel.app`)

## Step 3: Update Backend CORS

1. Go back to Render → your backend service
2. Go to **Environment** tab
3. Update `FRONTEND_ORIGIN` to your Vercel URL
4. Save and redeploy

## Step 4: Run Database Migration

1. In Render, go to your backend service
2. Click **"Shell"** tab
3. Run:
   ```bash
   psql $DATABASE_URL -f backend/src/db/migrations/008_election_monitoring.sql
   ```

## Step 5: Access Your App

- **Frontend**: `https://your-app.vercel.app`
- **Backend API**: `https://your-backend.onrender.com`

## Default Login
Use the credentials created during setup. Check `backend/scripts/create_test_users.cjs` for test accounts.

## Notes
- Free tier services may spin down after inactivity. First request after sleep takes ~30 seconds.
- Keep your Supabase database URL secure and never commit it to Git.
- For production, generate a new JWT_SECRET instead of using the default.
