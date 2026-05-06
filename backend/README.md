# EMB RAG Chatbot 🌿

A **RAG (Retrieval Augmented Generation)** chatbot built on the EMB Global AI delivery stack. Upload PDF, TXT, or MD documents and ask questions. Get answers with source citations.

---

## What is RAG?

RAG stands for Retrieval Augmented Generation. Instead of the AI guessing answers, it:
1. Reads your uploaded document
2. Finds the most relevant parts
3. Answers based only on those parts
4. Shows you exactly which part it used (citations)

---

## Tech Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Frontend | React + Vite | Chat UI |
| Backend | FastAPI | Python API server |
| Embeddings | sentence-transformers | Convert text to vectors |
| Vector Search | FAISS | Find similar chunks |
| LLM | OpenRouter free router | Generate answers |
| PDF Parsing | pypdf | Extract text from PDFs |

---

## Features

- Upload PDF, TXT, MD documents
- Ask questions in natural language
- Answers grounded only in your document
- Source citations with every answer
- Multi-turn conversation memory
- Free AI routing through OpenRouter (`openrouter/free`)

---

## Project Structure
