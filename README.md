# Aryan's Assistant

An AI chatbot built with the MERN stack and a microservice-style backend.

> **Status: work in progress.** So far the project has Google login, session
> handling and the app skeleton. The chat and AI features are not built yet.

## What works so far

- Sign in with Google (Firebase Authentication)
- Server-side session management using Redis (7-day sessions, httpOnly cookie)
- Automatic login on page refresh (the app asks the backend "who am I?")
- Logout endpoint that destroys the session
- Login screen UI built with Tailwind CSS

## Tech stack

| Part | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS, Redux Toolkit, Axios |
| API gateway | Node.js, Express, express-http-proxy |
| Auth service | Node.js, Express, MongoDB (Mongoose), Firebase Admin SDK |
| Sessions | Redis (via ioredis), run in Docker |

## Architecture

```
Browser (React, :5173)
   |
   v
Gateway (:PORT)  --- reads sessions from ---> Redis (Docker, :6379)
   |  /api/me        (protected, answered by the gateway itself)
   |  /api/auth/*    (forwarded)
   v
Auth service  --- stores users in ---> MongoDB
   |  /login, /logout
   +--- writes/deletes sessions in ---> Redis
```

- **Gateway** is the only server the browser talks to. It handles CORS and
  cookies, protects private routes, and forwards `/api/auth/*` to the auth service.
- **Auth service** verifies Google/Firebase tokens, creates users in MongoDB and
  creates sessions in Redis.
- **Redis** stores sessions as `session:<id>` with a 7-day expiry. It is fast
  and expires old sessions on its own.

### How login works

1. User clicks **Continue with Google**. Firebase opens the Google popup and
   returns an ID token.
2. Frontend sends the token to `POST /api/auth/login`.
3. The auth service verifies the token with the Firebase Admin SDK, then finds
   or creates the user in MongoDB.
4. It saves the user's info in Redis under a random session id and sends that
   id to the browser as an httpOnly cookie.
5. On later requests (and page refreshes), `GET /api/me` runs the `protect`
   middleware: cookie -> Redis lookup -> `req.user` -> response.
6. The frontend stores the result in Redux (`state.user.userData`). If it is
   `null`, the login popup is shown.

## Project structure

```
aryanAI/
├── Backend/
│   ├── docker-compose.yml        # Redis container
│   ├── gateway/                  # API gateway (index.js, middleware/, controllers/)
│   ├── services/auth/            # Auth service (routes/, controllers/, modal/, config/)
│   └── shared/redis/redis.js     # Redis client shared by both services
└── Frontend/vite-project/
    ├── src/                      # App.tsx, main.tsx, pages/Home.tsx, features/
    ├── redux/                    # Redux store and user slice
    └── utils/                    # axios instance, Firebase setup
```

## API endpoints

| Method | Path (via gateway) | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | No | Verify Firebase token, create session |
| GET | `/api/auth/logout` | No | Delete session |
| GET | `/api/me` | Yes | Return the logged-in user |

## Running it locally

### Prerequisites

- Node.js, Docker, a MongoDB database (e.g. MongoDB Atlas) and a Firebase
  project with Google sign-in enabled.

### 1. Start Redis

```bash
cd Backend
docker compose up -d
```

### 2. Environment variables

Create a `.env` file in each folder. These files are git-ignored.

**`Backend/gateway/.env`**

| Variable | Example / meaning |
| --- | --- |
| `PORT` | `8000` |
| `FORNTEND_URL` | `http://localhost:5173` (spelling matches the code) |
| `AUTH_Service` | URL of the auth service, e.g. `http://localhost:5000` |
| `REDIS_URL` | `redis://localhost:6379` |

**`Backend/services/auth/.env`**

| Variable | Example / meaning |
| --- | --- |
| `PORT` | `5000` |
| `MONGODB_URI` | Your MongoDB connection string |
| `REDIS_URL` | `redis://localhost:6379` |

Also place your Firebase service account key at
`Backend/services/auth/serviceAccountKey.json` (never commit it).

**`Frontend/vite-project/.env`**

| Variable | Example / meaning |
| --- | --- |
| `VITE_SERVER_URL` | `http://localhost:8000` (the gateway) |
| `VITE_FIREBASE_API_KEY` | From your Firebase web app config |

### 3. Install and run each part

```bash
# Gateway
cd Backend/gateway && npm install && npm run dev

# Auth service
cd Backend/services/auth && npm install && npm run dev

# Frontend
cd Frontend/vite-project && npm install && npm run dev
```

Open the Vite URL (usually http://localhost:5173) and sign in with Google.

## Roadmap

- [ ] Chat UI (message list, input, sidebar)
- [ ] Connect an LLM (e.g. the Claude API) with streaming replies
- [ ] Chat service: store conversations in MongoDB
- [ ] Logout button in the UI
- [ ] Production hardening (HTTPS, `secure` cookies, 401 status codes)
