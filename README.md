# Aryan's Assistant

A multi-agent AI assistant built with the MERN stack and a microservice backend.
Ask a question and a router sends it to the right agent, which can chat, search
the web, write code with a live preview, or create PDFs, slide decks and images.

## Features

- **Six agents:** chat, web search, coding, PDF, PowerPoint and image generation
- **Automatic routing:** Auto mode picks the agent for each message, or you can
  choose one yourself from the input box
- **Streaming replies** over Server-Sent Events, with a Stop button
- **Artifact panel:** live preview for generated web pages, tabs for each code
  file, built-in viewing for PDFs and decks, plus copy and download
- **Saved conversations:** create, search, delete and reopen chats
- **Google sign-in** with server-side sessions in Redis (7 days, httpOnly cookie)
- **Private file storage:** generated files live in a private S3 bucket and only
  their owner can open them
- **Resizable layout:** drag the sidebar and artifact panel, or collapse them

## Agents

| Agent | Use it for | Powered by |
| --- | --- | --- |
| `chat` | Conversation, explanations, general questions | Groq |
| `search` | Current information from the web | Tavily, then Groq |
| `coding` | Writing, fixing and explaining code | OpenRouter |
| `pdf` | Reports, notes and other PDF documents | Groq, Puppeteer, S3 |
| `ppt` | PowerPoint decks, with a PDF copy for preview | Groq, PptxGenJS, Puppeteer, S3 |
| `imageGen` | Images, logos and artwork | Groq, Pollinations.ai, S3 |

## Tech stack

| Part | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS, Redux Toolkit, Axios |
| API gateway | Node.js, Express, express-http-proxy |
| Auth service | Node.js, Express, MongoDB (Mongoose), Firebase Admin SDK |
| Chat service | Node.js, Express, MongoDB (Mongoose) |
| Agent service | Node.js, Express, LangGraph, LangChain |
| Sessions | Redis (via ioredis), run in Docker |
| File storage | AWS S3 |

## Architecture

```
                 Browser (React, :5173)
                          |
                          v
                   Gateway (:8000) ------- reads sessions -------> Redis (:6379)
                          |                                          ^
       +------------------+------------------+                       |
       | /api/auth/*      | /api/chat/*      | /api/agent/*          |
       v                  v                  v                       |
  Auth (:8001)       Chat (:8002) <----- Agent (:8003)               |
       |                  |     history,     |                       |
       |                  |     replies      +--> LLMs, Tavily,      |
       |                  |                  |    Pollinations       |
       |                  v                  +--> S3                 |
       +-----------> MongoDB                                         |
       |                                                             |
       +-------------------- writes sessions ------------------------+
```

- **Gateway:** the only server the browser talks to. It handles CORS and cookies,
  checks the session on private routes, and forwards requests to the services
  with the user's id in a header.
- **Auth service:** verifies Google/Firebase tokens, stores users in MongoDB and
  creates sessions in Redis.
- **Chat service:** stores conversations and messages in MongoDB.
- **Agent service:** runs the agent graph, streams replies to the browser, and
  saves generated files to S3.

### How a message is handled

```
START -> router -> chat ------------> END
              |--> coding ----------> END
              |--> pdf -------------> END
              |--> ppt -------------> END
              |--> imageGen --------> END
              +--> search --> chat -> END
```

1. The frontend streams `POST /api/agent/chat/stream` through the gateway.
2. The agent service loads the conversation's history from the chat service.
3. The router uses the agent picked in the UI, or asks a fast LLM to choose one.
   If routing fails, it falls back to `chat`.
4. The agent does its work. `search` fetches web results and hands them to `chat`
   to write the reply.
5. The reply is saved through the chat service. Code, PDFs and decks then open in
   the artifact panel.

Generated files are stored in S3, and messages keep a permanent
`/api/agent/files/...` path to them. Opening that path checks the owner and
redirects to a temporary S3 link, so the bucket stays private and old chats keep
working.

### How login works

1. **Continue with Google** opens the Firebase popup, which returns an ID token.
2. The frontend sends the token to `POST /api/auth/login`.
3. The auth service verifies it with the Firebase Admin SDK, then finds or creates
   the user in MongoDB.
4. It saves the user's info in Redis as `session:<id>` and sends the id to the
   browser as an httpOnly cookie.
5. On later requests, the gateway's `protect` middleware looks the cookie up in
   Redis before letting the request through.

## Project structure

```
aryanAI/
├── Backend/
│   ├── docker-compose.yml     # Redis container
│   ├── gateway/               # API gateway (middleware/, controllers/, utils/)
│   ├── services/
│   │   ├── auth/              # Login, logout, users (routes/, controllers/, modal/)
│   │   ├── chat/              # Conversations and messages (routes/, controllers/, models/)
│   │   └── agent/
│   │       ├── graph/         # LangGraph workflow, router and state
│   │       ├── agents/        # One file per agent
│   │       ├── controllers/   # Agent runs and file downloads
│   │       ├── config/        # LLM models, S3, MongoDB
│   │       └── utils/         # PDF and PPTX rendering, S3 upload
│   └── shared/redis/          # Redis client used by the gateway and auth service
└── Frontend/vite-project/
    ├── src/
    │   ├── pages/             # Home: login and the main layout
    │   ├── components/        # ChatArea, SideBar, Artifact, ResizeHandle, ui/
    │   ├── features/          # Current user lookup, chat streaming
    │   └── index.css          # Theme colours and fonts
    ├── redux/                 # Store and user slice
    └── utils/                 # Axios instance, Firebase setup
```

## API endpoints

All paths go through the gateway. "Auth" means a valid session cookie is required.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | No | Verify a Firebase token and create a session |
| GET | `/api/auth/logout` | No | Delete the session |
| GET | `/api/me` | Yes | Return the logged-in user |
| POST | `/api/chat/create-conversation` | Yes | Create a conversation |
| GET | `/api/chat/get-conversation` | Yes | List the user's conversations |
| POST | `/api/chat/update-conversation` | Yes | Rename a conversation |
| DELETE | `/api/chat/delete-conversation/:id` | Yes | Delete a conversation and its messages |
| POST | `/api/chat/save-messages` | Yes | Save a message |
| GET | `/api/chat/get-messages/:conversationId` | Yes | Get a conversation's messages |
| POST | `/api/agent/chat` | Yes | Run the agents and return the full reply |
| POST | `/api/agent/chat/stream` | Yes | Run the agents and stream the reply |
| GET | `/api/agent/files/*key` | Yes | Open a generated file (`?download=1` to save it) |

## Running it locally

### Prerequisites

- Node.js and Docker
- A MongoDB database (for example, MongoDB Atlas)
- A Firebase project with Google sign-in enabled
- An AWS S3 bucket, with credentials that can read and write to it
- API keys for [Groq](https://console.groq.com),
  [OpenRouter](https://openrouter.ai), [Tavily](https://tavily.com) and
  [Google AI Studio](https://aistudio.google.com)

### 1. Start Redis

```bash
cd Backend
docker compose up -d
```

### 2. Add environment variables

Create a `.env` file in each folder below. These files are git-ignored.

**`Backend/gateway/.env`**

| Variable | Value |
| --- | --- |
| `PORT` | `8000` |
| `FORNTEND_URL` | `http://localhost:5173` (the spelling matches the code) |
| `AUTH_Service` | `http://localhost:8001` |
| `CHAT_Service` | `http://localhost:8002` |
| `AGENT_Service` | `http://localhost:8003` |
| `REDIS_URL` | `redis://localhost:6379` |

**`Backend/services/auth/.env`**

| Variable | Value |
| --- | --- |
| `PORT` | `8001` |
| `MONGODB_URI` | Your MongoDB connection string |
| `REDIS_URL` | `redis://localhost:6379` |

Also save your Firebase service account key as
`Backend/services/auth/serviceAccountKey.json`. It is git-ignored; never commit it.

**`Backend/services/chat/.env`**

| Variable | Value |
| --- | --- |
| `PORT` | `8002` |
| `MONGODB_URI` | Your MongoDB connection string |

**`Backend/services/agent/.env`**

| Variable | Value |
| --- | --- |
| `PORT` | `8003` |
| `MONGODB_URI` | Your MongoDB connection string |
| `CHAT_SERVICE` | `http://localhost:8002` |
| `GROQ_API_KEY` | Groq key, used by most agents and the router |
| `CODING_AGENT_KEY` | OpenRouter key, used by the coding agent |
| `TAVILY_API_KEY` | Tavily key, used by the search agent |
| `GOOGLE_API_KEY` | Google AI key. No agent uses Gemini yet, but the service won't start without it |
| `AWS_REGION` | Your bucket's region |
| `AWS_ACCESS_KEY_ID` | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials |
| `S3_BUCKET` | Your bucket's name |
| `CODING_AGENT_MODEL` | Optional. OpenRouter model to use instead of the default |
| `IMAGE_MODEL` | Optional. Pollinations model, `flux` by default |
| `POLLINATIONS_API_KEY` | Optional. Removes the free tier's limit of one new image every 45 seconds |

**`Frontend/vite-project/.env`**

| Variable | Value |
| --- | --- |
| `VITE_SERVER_URL` | `http://localhost:8000` (the gateway) |
| `VITE_FIREBASE_API_KEY` | From your Firebase web app config |

The other Firebase settings are in `Frontend/vite-project/utils/firebase.js`.
Replace them with your own project's values.

### 3. Install and run each part

Run each of these in its own terminal:

```bash
# Shared Redis client (install once, no server to run)
cd Backend && npm install

# Gateway
cd Backend/gateway && npm install && npm run dev

# Auth service
cd Backend/services/auth && npm install && npm run dev

# Chat service
cd Backend/services/chat && npm install && npm run dev

# Agent service (the install also downloads a Chromium build for Puppeteer)
cd Backend/services/agent && npm install && npm run dev

# Frontend
cd Frontend/vite-project && npm install && npm run dev
```

Open http://localhost:5173 and sign in with Google.
