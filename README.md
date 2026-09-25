# Pulse Chat — Production Real-Time Collaborative Messaging Platform

[![Next.js 16](https://img.shields.io/badge/Next.js-16.3-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.2-blue?style=flat&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-6.19-2D3748?style=flat&logo=prisma)](https://www.prisma.io/)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat&logo=mongodb)](https://www.mongodb.com/atlas)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Pulse Chat is a full-featured, real-time messaging application engineered with clean, scalable architecture for deployment on **Vercel** serverless infrastructure and **MongoDB Atlas**. Designed as an enterprise-grade portfolio project, it demonstrates best practices in reactive client state management, event-driven architecture, robust security, and type safety across the full stack.

---

## Architecture Diagram

```mermaid
flowchart TD
    subgraph Client["Next.js App Router Client (React 19)"]
        UI["Modern Responsive UI\n(Desktop / Tablet / Mobile)"]
        RTClient["Pusher JS Client\n(Realtime Presence & Subscriptions)"]
        State["React Context & Optimistic State\n(Toast, Presence, Messages)"]
    end

    subgraph Edge["Vercel Edge / Serverless"]
        Middleware["Edge Auth Middleware\n(Session Guard & Redirection)"]
        NextAuth["Auth.js / NextAuth v5\n(Credentials & Encrypted JWT)"]
        APIRoutes["Route Handlers & Rate Limiter\n(/api/conversations, /api/messages, etc.)"]
        RealtimeLayer["Realtime Abstraction Layer\n(lib/realtime/server.ts)"]
    end

    subgraph External["Cloud Infrastructure"]
        Pusher["Pusher Channels\n(WebSockets / PubSub / Presence)"]
        Mongo["MongoDB Atlas\n(Replica Set / Document Database)"]
        Storage["Cloudinary / Object Storage\n(Media & File Attachments)"]
    end

    UI --> State
    State <--> RTClient
    RTClient <--> Pusher
    UI --> Middleware
    Middleware --> APIRoutes
    APIRoutes --> NextAuth
    APIRoutes --> RealtimeLayer
    RealtimeLayer --> Pusher
    APIRoutes --> Mongo
    APIRoutes --> Storage
```



---

## Key Features

### 1. Secure Authentication & Authorization
- **Credentials Authentication**: Secure registration and login using email and password.
- **Argon2/Bcrypt Password Hashing**: Salted multi-round password hashing with zero password hash leakage to clients.
- **Session Protection**: NextAuth v5 with tamper-proof encrypted JWT cookies and edge-ready route middleware.
- **Granular Authorization**: Strict conversation membership verification before retrieving or posting messages; role-based admin controls for group management.

### 2. Real-Time Messaging & Status Indicators
- **Instant Delivery**: Server-triggered WebSocket broadcast via Pusher Channels, fully decoupled via `lib/realtime/`.
- **Optimistic UI Updates**: Immediate message rendering with sending spinner, automatically reconciling on server confirmation.
- **Delivery & Seen Receipts**: Comprehensive status indicators: *Sending* (clock), *Sent/Delivered* (checkmark), and *Seen* (double checkmarks with read receipt timestamps).
- **Infinite Scroll & History**: Cursor-based reverse pagination to load earlier messages without layout shift.

### 3. Presence & Ephemeral Indicators
- **Online Presence**: Online/offline indicators powered natively by Pusher Presence Channels without wasteful database polling or writes.
- **Last Seen Timestamps**: Dynamically formatted timestamps (`date-fns`) for inactive users.
- **Live Typing Indicators**: Debounced typing status broadcast directly over WebSocket channels without writing ephemeral events to MongoDB.

### 4. Message Actions & Interactions
- **Message Editing**: In-place editing of sent messages with `(edited)` visual tags (author-only verification).
- **Soft Deletion**: Message deletion preserving thread audit history while redacting content.
- **Emoji Reactions**: Real-time reaction picker (`❤️`, `👍`, `😂`, `🔥`, etc.) with user reaction toggling.
- **Reply Threading**: Quoted message replies displaying original author and content preview.
- **Clipboard Integration**: Quick-copy message text action.

### 5. Group Chats & Team Collaboration
- **Group Creation**: Custom group name, optional group avatar, and multi-member selection.
- **Admin Management**: Group admins can edit settings, invite new members, and remove members.
- **Member Self-Management**: Group members can leave groups independently.
- **System Activity Messages**: Automatically generated audit messages for member joins, leaves, and removals.

### 6. Media & File Sharing
- **Multi-Format Support**: Images (`JPG`, `PNG`, `GIF`, `WebP`) and documents (`PDF`, `DOCX`, `TXT`, `ZIP`).
- **Cloud Storage & Local Fallback**: Integrated Cloudinary upload pipeline with automated fallback to local storage handler.
- **Metadata Storage**: MongoDB stores only URLs, file sizes, and MIME types—never binary blobs.
- **Lightbox Preview**: Built-in modal lightbox for full-resolution image preview.

### 7. Search & Notifications
- **Global User Search**: Debounced search across users and active conversations.
- **In-Conversation Search**: Full-text message search inside active conversations with match highlights.
- **Real-Time Notifications**: Unread badges in the sidebar, in-app notifications, and browser notification integration.

### 8. WebRTC 1-to-1 Audio & Video Calling & Socket.io Signaling
- **Direct P2P Media Streams**: Low-latency video and audio calling powered by native WebRTC with multi-tier STUN and secure TURN relay servers (Google, Cloudflare, Twilio, and OpenRelay TLS).
- **Dual Signaling Architecture**:
  - **Zero-Config Database Signaling (Vercel/Serverless ready)**: Persistent, cross-instance MongoDB-backed signaling queue (`CallSignal`) ensuring 100% reliable call delivery across isolated serverless lambdas and mobile networks.
  - **Optional Standalone Socket.io Server**: Dedicated real-time WebSocket server (`npm run socket-server` on port 4000) for sub-10ms signaling on dedicated servers, Render, or VPS.
  - **Pusher Channels Integration**: Cloud WebSocket pub/sub for push events and presence.
- **Batched ICE Candidate Transmission**: Reduces dozens of rapid ICE candidate network requests into smooth batches to prevent dropped candidates on mobile connections.
- **In-Call Controls**: Picture-in-picture local preview, camera flip/toggle, microphone mute/unmute, desktop screen sharing, full-screen expansion, and live call timer.
- **Synthesized Audio Feedback**: Clean telephone ringtone, connected chime, and hangup tones generated dynamically using the Web Audio API with zero external audio assets.
- **Smart Ringtones (Online vs. Offline)**: Plays dynamic ringing when recipient is live online, and switches to a distinct connecting pulse when the recipient is offline (WhatsApp/Messenger style).
- **Persistent Call Logs**: Every call (completed or missed) produces a persistent audit log in the conversation thread with call duration, status badge, and an instant "Call Back" button.
- **Live Ongoing Visualizer**: Displays an animated audio waveform indicator and running timer during active calls.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router, Server Components, Route Handlers) |
| **Language** | [TypeScript 5](https://www.typescriptlang.org/) (Strict mode, full type safety) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) with custom dark theme design system |
| **Database** | [MongoDB Atlas](https://www.mongodb.com/atlas) with replica set support |
| **ORM** | [Prisma 6](https://www.prisma.io/) (`provider = "mongodb"`) |
| **Authentication** | [Auth.js / NextAuth v5](https://authjs.dev/) with Credentials & JWT |
| **Realtime & Calling**| [WebRTC](https://webrtc.org/) (P2P audio/video/screen), [Pusher Channels](https://pusher.com/) |
| **Validation** | [Zod 3](https://zod.dev/) for strict schema validation across all boundaries |
| **Testing** | [Vitest](https://vitest.dev/) for unit and authorization policy test suites |
| **Icons** | [Lucide React](https://lucide.dev/) |

---

## Database Design

The schema is defined in `prisma/schema.prisma` targeting MongoDB:

```mermaid
erDiagram
    User ||--o{ ConversationMember : joins
    User ||--o{ Message : sends
    User ||--o{ MessageReaction : reacts
    User ||--o{ ReadReceipt : reads
    Conversation ||--o{ ConversationMember : has
    Conversation ||--o{ Message : contains
    Message ||--o{ MessageReaction : receives
    Message ||--o{ ReadReceipt : tracked_by
    Message ||--o{ Message : replies_to

    User {
        ObjectId id PK
        string name
        string email UK
        string passwordHash
        string avatar
        string bio
        datetime lastSeen
        datetime createdAt
        datetime updatedAt
    }

    Conversation {
        ObjectId id PK
        enum type "DIRECT | GROUP"
        string name
        string avatar
        datetime createdAt
        datetime updatedAt
    }

    ConversationMember {
        ObjectId id PK
        ObjectId conversationId FK
        ObjectId userId FK
        enum role "ADMIN | MEMBER"
        datetime joinedAt
    }

    Message {
        ObjectId id PK
        ObjectId conversationId FK
        ObjectId senderId FK
        string content
        enum type "TEXT | IMAGE | FILE | SYSTEM"
        string attachmentUrl
        string attachmentName
        int attachmentSize
        string attachmentType
        ObjectId replyToId FK
        datetime editedAt
        datetime deletedAt
        datetime createdAt
        datetime updatedAt
    }

    MessageReaction {
        ObjectId id PK
        ObjectId messageId FK
        ObjectId userId FK
        string reaction
        datetime createdAt
    }

    ReadReceipt {
        ObjectId id PK
        ObjectId messageId FK
        ObjectId userId FK
        datetime readAt
    }
```

### Database Optimization & Indexing
- `ConversationMember`: Unique compound index `@@unique([conversationId, userId])` prevents duplicate memberships and speeds up membership lookups.
- `Message`: Compound index `@@index([conversationId, createdAt])` optimizes chat history queries and cursor pagination.
- `MessageReaction`: Unique compound index `@@unique([messageId, userId, reaction])` ensures reaction idempotency.
- `ReadReceipt`: Compound index `@@unique([messageId, userId])` avoids duplicate read receipt records.

---

## Local Setup

### Prerequisites
- **Node.js**: v20+ (v24 recommended)
- **npm** or **pnpm**
- **MongoDB Atlas** account (or local MongoDB with replica set enabled)
- **Pusher Channels** account (free tier works out of the box)

### 1. Clone & Install
```bash
git clone https://github.com/roy-sumon/chat-applications.git
cd chat-applications
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in the parameters (see [Environment Variables](#environment-variables) below).

### 3. Initialize Prisma Client
```bash
npx prisma generate
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## MongoDB Atlas Setup

1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Under **Database Access**, create a user with `Read and write to any database` permissions.
3. Under **Network Access**, add IP `0.0.0.0/0` (Allow Access from Anywhere) for serverless deployments.
4. Click **Connect** -> **Drivers** -> **Node.js**, and copy your connection string.
5. Set `DATABASE_URL` in your `.env`:
   ```env
   DATABASE_URL="mongodb+srv://<username>:<password>@<cluster-url>/pulse_chat?retryWrites=true&w=majority"
   ```

---

## Realtime Architecture (Why Pusher on Vercel?)

Traditional WebSocket servers (such as persistent Socket.IO servers) rely on long-lived TCP connections. On serverless platforms like **Vercel**, serverless execution functions freeze and spin down after requests finish, which terminates persistent Socket.IO server instances.

Pulse Chat uses a **decoupled real-time architecture** implemented in `lib/realtime/`:
- **Serverless REST Events**: Route handlers trigger WebSocket broadcasts to Pusher via HTTP REST API.
- **Client WebSockets**: The client connects to Pusher Channels directly via WebSockets.
- **Channel Security**: Private and presence channels require server-side token authentication (`/api/pusher/auth`), strictly enforcing conversation membership before granting listening permissions.
- **Fallback / Mock Mode**: If Pusher credentials are omitted in local development, the service layer operates safely in fallback mode without crashing database persistence.

### Realtime Setup (Pusher Channels)
1. Sign up at [Pusher Channels](https://pusher.com/channels).
2. Create an App (e.g. `pulse-chat`, Cluster: `mt1`).
3. Under **App Keys**, copy `app_id`, `key`, `secret`, and `cluster`.
4. Enable **Client Events** in App Settings if direct client-to-client events are desired.
5. Add keys to `.env`:
   ```env
   PUSHER_APP_ID="your_app_id"
   PUSHER_SECRET="your_secret"
   NEXT_PUBLIC_PUSHER_KEY="your_key"
   NEXT_PUBLIC_PUSHER_CLUSTER="mt1"
   ```

---

## File Storage Setup (Cloudinary)

Pulse Chat supports seamless media storage:
1. Create a free account at [Cloudinary](https://cloudinary.com/).
2. Copy your **Cloud Name**, **API Key**, and **API Secret** from Dashboard.
3. Add to `.env`:
   ```env
   CLOUDINARY_CLOUD_NAME="your_cloud_name"
   CLOUDINARY_API_KEY="your_api_key"
   CLOUDINARY_API_SECRET="your_api_secret"
   ```
4. If Cloudinary credentials are not configured, the app automatically falls back to local disk storage in `public/uploads/`.

---

## Environment Variables

| Variable | Description | Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | MongoDB Atlas replica set URI | `mongodb+srv://user:pass@cluster.mongodb.net/chat` |
| `AUTH_SECRET` | NextAuth JWT & cookie encryption key | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Application canonical URL | `http://localhost:3000` |
| `NEXT_PUBLIC_APP_URL` | Public frontend URL | `http://localhost:3000` |
| `PUSHER_APP_ID` | Pusher server application ID | `1234567` |
| `PUSHER_SECRET` | Pusher server secret key | `abcdef123456` |
| `NEXT_PUBLIC_PUSHER_KEY`| Pusher public client key | `a1b2c3d4e5` |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | Pusher region cluster | `mt1` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud identifier (optional) | `my-cloud` |
| `CLOUDINARY_API_KEY` | Cloudinary API key (optional) | `987654321` |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret (optional) | `secret_token` |

---

## Security Considerations

- **Authorization Guards**: Every conversation read, message dispatch, edit, deletion, or membership change checks identity against MongoDB relations. Client-provided user IDs are never trusted for authorization.
- **Rate Limiting**: Sliding window rate limiting guards `/api/auth/register` and `/api/conversations/[id]/messages` against brute-force attacks and automated flooding.
- **Input Validation**: All incoming requests pass through strict Zod schemas with sanitization.
- **Credential Protection**: Passwords are saved only as bcrypt hashes. Database queries for user records explicitly omit `passwordHash` in API responses.
- **Pusher Auth Verification**: Clients cannot snoop on other users' conversations; channel authorization endpoints verify membership before signing Pusher presence tokens.
- **File Validation**: Strict file type whitelisting and 10MB file size bounds prevent malicious payload uploads.

---

## Development Commands

```bash
# Start development server
npm run dev

# Run unit and authorization policy test suites
npm run test

# Run TypeScript compiler check
npx tsc --noEmit

# Run ESLint validation
npm run lint

# Build production bundle
npm run build

# Start production server
npm run start
```

---

## Vercel Deployment

Deploying Pulse Chat to Vercel is seamless:

1. Push your repository to **GitHub**.
2. Go to [Vercel Dashboard](https://vercel.com/new) and import your repository.
3. In **Environment Variables**, supply:
   - `DATABASE_URL` (MongoDB Atlas URI)
   - `AUTH_SECRET` (generate with `openssl rand -base64 32`)
   - `NEXTAUTH_URL` (`https://<your-project-name>.vercel.app`)
   - `NEXT_PUBLIC_APP_URL` (`https://<your-project-name>.vercel.app`)
   - `PUSHER_APP_ID`, `PUSHER_SECRET`, `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (recommended for cloud storage on serverless)
4. Click **Deploy**. Vercel will run `prisma generate` during `postinstall` and complete the build.

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
