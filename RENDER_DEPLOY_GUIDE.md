# Render.com Deployment Guide for Pulse Chat

This guide explains how to deploy **Pulse Chat** (Next.js 16 + WebRTC calling + Socket.io real-time chat) on [Render.com](https://render.com) using a single, unified Node.js Web Service.

---

## Architecture on Render

Pulse Chat uses a unified server architecture (`server.js`) that runs:
1. **Next.js 16** (SSR, API routes, React Server & Client Components)
2. **Socket.io WebSockets** (Sub-10ms instant chat, typing indicators, reactions, WebRTC audio/video call signaling)

Both run on the **same port** and **same domain**, so:
* No CORS configuration issues.
* No need to pay for or manage two separate services.
* Runs 100% within Render's Free Web Service tier.

---

## Step-by-Step Deployment Instructions

### Step 1: Sign up & Connect GitHub
1. Log in to your [Render.com Dashboard](https://dashboard.render.com).
2. Click **New +** in the top right corner and select **Web Service**.
3. Choose **Build and deploy from a Git repository**.
4. Connect your GitHub account and select the **`chat-applications`** repository.

---

### Step 2: Configure the Web Service
Fill in the following settings:

| Setting | Value |
| :--- | :--- |
| **Name** | `pulse-chat` *(or your preferred name)* |
| **Region** | Oregon (US West) or Frankfurt (EU) or Singapore |
| **Branch** | `render` |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npx prisma generate && npm run build` |
| **Start Command** | `npm start` *(or `node server.js`)* |
| **Instance Type** | `Free` |

---

### Step 3: Add Environment Variables
Scroll down to the **Environment Variables** section and add the following:

| Key | Value | Description |
| :--- | :--- | :--- |
| `NODE_VERSION` | `20.18.0` | Ensures Render uses Node.js 20+ for Next.js 16 |
| `NODE_ENV` | `production` | Enables production optimizations |
| `DATABASE_URL` | `mongodb+srv://...` | Your MongoDB Atlas connection string |
| `AUTH_SECRET` | *(Random 32-byte secret)* | Generate with `openssl rand -base64 32` or type any secure string |
| `AUTH_TRUST_HOST` | `true` | Required for NextAuth behind Render reverse proxy |
| `NEXTAUTH_URL` | `https://your-service-name.onrender.com` | Your Render app URL *(update once generated)* |
| `NEXT_PUBLIC_APP_URL` | `https://your-service-name.onrender.com` | Your Render app URL |
| `REALTIME_PROVIDER` | `pusher` | Real-time fallback provider |
| `PUSHER_APP_ID` | `your_pusher_app_id` | (From your `.env`) |
| `PUSHER_SECRET` | `your_pusher_secret` | (From your `.env`) |
| `NEXT_PUBLIC_PUSHER_KEY` | `your_pusher_key` | (From your `.env`) |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | `mt1` | (From your `.env`) |

> **Note on App URL**: When creating the service, Render shows you what your URL will be (e.g. `pulse-chat.onrender.com`). Set both `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` to `https://pulse-chat.onrender.com`.

---

### Step 4: Deploy
1. Click **Create Web Service** at the bottom.
2. Render will automatically pull the `render` branch, run the build command, and start `server.js`.
3. Once the build finishes and the log shows:
   ```
   > [Pulse Chat] Server ready at http://0.0.0.0:10000 (Production: true)
   ==> Your service is live 🎉
   ```
4. Open your live URL in your browser!

---

## Verifying Socket.io & WebRTC Calling

1. Open your Render app on two devices or two browser windows.
2. Log in with two different accounts.
3. Open a direct chat:
   - Typing in the input will show instant typing indicators via WebSockets.
   - Sending messages will deliver in <10ms.
4. Click the **Call** button (Audio or Video):
   - Ringing will play on the receiver's device immediately.
   - Upon answering, WebRTC audio/video will connect with the Web Audio API hardware pipeline.
   - Toggle **Loudspeaker / Normal** to test the hardware volume boost.
