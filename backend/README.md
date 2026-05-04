# EMB RAG Chatbot

A RAG (Retrieval Augmented Generation) chatbot built on the EMB Global tech stack.
Upload PDF, TXT, or MD files and ask questions about them.

## Tech Stack

- **Backend**: FastAPI + FAISS + sentence-transformers
- **Frontend**: React + Vite
- **AI Model**: Llama 3.1 via Groq (free)
- **Document Support**: PDF, TXT, MD

## Setup Instructions

### 1. Clone the repository

git clone https://github.com/yourusername/chatbot-techstack.git
cd chatbot-techstack

### 2. Backend Setup

cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt

### 3. Create your .env file

Copy .env.example to .env and add your key:

GROQ_API_KEY=your_groq_api_key_here

Get your free key from: https://console.groq.com

### 4. Run the backend

python -m uvicorn main:app --reload --port 8000

### 5. Frontend Setup

cd ../frontend
npm install
npm run dev

### 6. Open the app

Go to http://localhost:5173

Upload a PDF or TXT file and start asking questions!

## Features

- Upload PDF, TXT, MD documents
- Ask questions about uploaded documents
- Citations showing which part of document was used
- Multi-turn conversation memory
- Dark theme UI