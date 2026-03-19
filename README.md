# 🤖 IT ServiceDesk AI Assistant

An AI-powered IT ServiceDesk chatbot built from scratch using LangChain, LangGraph, RAG, ChromaDB, FastAPI, and Next.js.

## 🏗️ Architecture
```
Next.js (Frontend + TypeScript Agents)
         ↓
FastAPI RAG Service (ChromaDB + Embeddings)
         ↓
Django DRF (Tickets + Auth)
```

## ✨ Features

- 🧠 **Multi-Agent System** — Router Agent classifies intent and dispatches to specialized agents
- 📚 **RAG Pipeline** — Retrieval Augmented Generation using ChromaDB and HuggingFace embeddings
- 🎫 **Ticket Creation** — Automatically creates IT support tickets in Django backend
- 💬 **Streaming Responses** — Word by word streaming like ChatGPT
- 📖 **Knowledge Base Management** — Upload PDF/TXT files or add text documents
- 🔍 **Semantic Search** — Finds relevant KB docs by meaning not just keywords

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, TypeScript, Tailwind CSS |
| AI Agents | LangChain, LangGraph |
| LLM | Groq (LLaMA3) |
| Vector DB | ChromaDB |
| Embeddings | HuggingFace all-MiniLM-L6-v2 |
| RAG Service | FastAPI, Python |
| Backend | Django REST Framework |
| Database | PostgreSQL |

## 🤖 Agents

### Router Agent
Classifies user intent and routes to correct agent:
- `it-qa-agent` → IT questions and knowledge base lookup
- `ticket-agent` → Ticket creation requests

### IT QA Agent
- Searches ChromaDB knowledge base using RAG
- Answers IT questions from company documents
- Suggests ticket creation when needed

### Ticket Agent
- Extracts issue details using LLM
- Creates tickets in Django backend
- Returns ticket confirmation

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- PostgreSQL

### 1. RAG Service
```bash
cd rag-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# Start ChromaDB
chroma run --host localhost --port 8001

# Start FastAPI
uvicorn main:app --host 127.0.0.1 --port 8002 --reload
```

### 2. Frontend
```bash
cd frontend
npm install

# Add .env.local
GROQ_API_KEY=your_groq_api_key
RAG_SERVICE_URL=http://127.0.0.1:8002
NEXT_PUBLIC_RAG_SERVICE_URL=http://127.0.0.1:8002
BACKEND_URL=http://127.0.0.1:8000

npm run dev
```

## 📁 Project Structure
```
helpdesk-ai/
├── rag-service/
│   ├── main.py              # FastAPI endpoints
│   ├── knowledge_base.py    # ChromaDB setup
│   └── requirements.txt
└── frontend/
    └── lib/
        └── agents/
            ├── shared/model.ts          # LLM config
            ├── router-agent/            # Intent classification
            ├── it-qa-agent/             # RAG + KB answers
            ├── ticket-agent/            # Ticket creation
            └── index.ts                 # Orchestrator
```

## 👨‍💻 Author

**Akash Jamagond**
- AI & Full Stack Developer at Radisys Corporation
- LinkedIn: [akash-jamagond](https://linkedin.com/in/akash-jamagond-ba5312281)
