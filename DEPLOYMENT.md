# ACOP Deployment Guide

## Overview
- **Frontend**: Vercel
- **Backend**: Render
- **Database**: Supabase PostgreSQL
- **Repo**: https://github.com/Shantali001/ACOP

---

## Step 1: Deploy Backend to Render

1. Open https://render.com and sign in
2. Click **New +** → **Web Service**
3. Connect GitHub and select `Shantali001/ACOP`
4. Configure:
   - **Name**: `acop-backend`
   - **Environment**: `Node`
   - **Build Command**: `cd backend && npm install && npm run build`
   - **Start Command**: `cd backend && node dist/server.js`
   - **Plan**: Free
5. Click **Advanced** → **Add Environment Variables**:
   - `NODE_ENV=production`
   - `PORT=4000`
   - `DATABASE_URL=<your Supabase Postgres connection string>`
   - `DATABASE_SSL=false`
   - `JWT_SECRET=<generate a secure random string>`
   - `JWT_EXPIRES_IN_SECONDS=3600`
   - `FRONTEND_ORIGIN=https://your-vercel-app.vercel.app`
   - `FRONTEND_ORIGINS=http://localhost:5173,http://192.168.1.28:5173,https://your-vercel-app.vercel.app`
   - `VERIFY_DB_ON_STARTUP=true`
   - `MODEM_DRIVER=serial`
6. Click **Create Web Service**
7. Wait for build to finish (~2-3 minutes)
8. Copy the Render URL, e.g. `https://acop-backend.onrender.com`

---

## Step 2: Deploy Frontend to Vercel

1. Open https://vercel.com and sign in
2. Click **Add New...** → **Project**
3. Import `Shantali001/ACOP`
4. Configure:
   - **Framework**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Add Environment Variables in Vercel UI:
   - `VITE_API_BASE_URL` = `https://your-render-backend.onrender.com`
   - `VITE_SUPABASE_URL` = `https://yvvxenphsotorklcsfpk.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_EYs9Mu0_NQS8_jQgKaxYkQ_4N5lwl2C`
6. Click **Deploy**
7. Wait ~1-2 minutes
8. Copy the Vercel URL, e.g. `https://acop.vercel.app`

---

## Step 3: Update Backend CORS on Render

1. Go to Render → `acop-backend` → **Environment**
2. Update `FRONTEND_ORIGIN` to your Vercel URL
3. Update `FRONTEND_ORIGINS` to include your Vercel URL
4. Save → Render will redeploy automatically

---

## Step 4: Run Database Migration

1. In Render, go to `acop-backend` → **Shell**
2. Run:
   ```bash
   psql $DATABASE_URL -f backend/src/db/migrations/008_election_monitoring.sql
   ```

---

## Step 5: Create Admin User

Run this locally or in Render shell:
```powershell
node backend/scripts/create_test_users.cjs
```

---

## Step 6: Share URLs

- **App**: `https://your-app.vercel.app`
- **Backend**: `https://your-backend.onrender.com`

---

## Notes
- Free tier services may spin down after inactivity. First load can take ~30 seconds.
- Never commit `.env` files to Git.
- For production, rotate `JWT_SECRET` to a strong random value.
