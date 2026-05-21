# Persist

**An AI agent management system with sophisticated memory architecture for use with local models using Apple's mlx-lm**


## Key Features

### 🧠 Three-Model Memory System
- **embedding
- **memory coordinator (finds relevant connections)
- **Your LLM of choice** as main agent with synthesis

### 📝 Journal Blocks
- Read-write memory managed by the LLM
- Access control per block
- Tool-based interface for self-organization

### 🔄 Shifting Context Window
- **STICKY**: System instructions, tools, memories
- **SHIFTING**: Conversation history (trimmed when needed)
- Configurable per agent

### 🤝 Agent Attachments
- Attach memory agents, tool agents, reflection agents
- Many-to-many relationships with priority ordering
- Modular AI collaboration

### 💬 Modern Chat UI
- Three-panel layout with tabs
- Streaming responses via Server-Sent Events
- Message actions: edit, regenerate, copy, fork
- Full conversation branching

### 🗃️ RAG Integration
- Upload and embed documents
- Vector similarity search across all sources
- Automatic memory surfacing

## Quick Start

See **[QUICKSTART.md](QUICKSTART.md)** for detailed setup instructions.

**TL;DR:**

```bash
# 1. Set up database
createdb persist
psql persist < scripts/schema.sql

# 2. Install dependencies
cd backend && pip install -r requirements.txt
cd ../frontend && npm install

# 3. Start everything
./start.sh
```

Frontend: http://localhost:5173
Backend: http://localhost:8000
API Docs: http://localhost:8000/docs

Stop with: `./stop.sh`

## Architecture

```
┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐
│   Left Panel    │  │  Middle Panel    │  │   Right Panel   │
├─────────────────┤  ├──────────────────┤  ├─────────────────┤
│ • Conversations │  │  Chat Interface  │  │ • Journal Blocks│
│ • Agent Settings│  │  with Streaming  │  │ • RAG Filesystem│
│ • Tools         │  │  and Actions     │  │ • Search        │
└─────────────────┘  └──────────────────┘  └─────────────────┘
```

## Memory Flow

1. **User sends message** → Embedded with gte-base
2. **Search** → Find top-50 memory candidates across:
   - Journal blocks
   - RAG documents
   - Past messages
3. **Memory coordinator** → Selects 5-10 relevant memories
4. **Main LLM** → Receives synthesis, not full memories
5. **Response** → Can create/update journal blocks
6. **Context window** → Trims old messages if needed

## Tech Stack

**Backend:**
- FastAPI (Python)
- PostgreSQL + pgvector
- MLX for local LLM inference
- SentenceTransformers for embeddings

**Frontend:**
- React + TypeScript
- Vite for dev server
- EventSource for streaming

## Philosophy

> "Whenever there's a question of more complexity, we want more complexity. This isn't a toy."

Appletta isn't about efficiency metrics. It's about giving AI:
- Space to develop persistent thoughts
- Tools to organize its own memory
- Freedom to make organic connections
- A way to grow across conversations

**Trust that past-you had a good reason to put it there.**

## Development

### Project Structure

```
persist/
├── backend/
│   ├── api/routes/        # FastAPI endpoints
│   ├── db/models/         # SQLAlchemy models
│   ├── schemas/           # Pydantic schemas
│   ├── services/          # Business logic
│   └── main.py            # App entry point
├── frontend/
│   └── src/
│       ├── components/    # React components
│       ├── api/           # API clients
│       └── types/         # TypeScript types
└── scripts/
    └── schema.sql         # Database schema
```

**Questions?** Check [QUICKSTART.md](QUICKSTART.md) for detailed documentation.
