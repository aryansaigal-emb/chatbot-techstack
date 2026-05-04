# ================================================================
#  EMB RAG Chatbot — Backend
#  FastAPI + FAISS + sentence-transformers + Groq (Free)
# ================================================================

import os
import io
from typing import List
from dotenv import load_dotenv
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
from groq import Groq
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Load API key ──────────────────────────────────────────────────
load_dotenv()
load_dotenv()
import os
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY not found in .env file")
# ── Groq client ───────────────────────────────────────────────────
groq_client = Groq(api_key=GROQ_API_KEY)

# ── Load embedding model ──────────────────────────────────────────
print("Loading embedding model...")
embedder = SentenceTransformer("all-MiniLM-L6-v2")
EMBED_DIM = 384

# ── FAISS index ───────────────────────────────────────────────────
index = faiss.IndexFlatIP(EMBED_DIM)

# ── Metadata store ────────────────────────────────────────────────
metadata_store: List[dict] = []

# ── FastAPI app ───────────────────────────────────────────────────
app = FastAPI(title="EMB RAG Chatbot")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request/Response models ───────────────────────────────────────
class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[Message] = []
    top_k: int = 4

class ChatResponse(BaseModel):
    answer: str
    sources: List[str]
    chunks_used: int


# ================================================================
#  HELPER FUNCTIONS
# ================================================================

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF using pypdf"""
    try:
        from pypdf import PdfReader
        pdf_file = io.BytesIO(file_bytes)
        reader = PdfReader(pdf_file)

        all_text = []
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text and page_text.strip():
                all_text.append(page_text)

        full_text = "\n\n".join(all_text)

        if not full_text.strip():
            raise HTTPException(
                status_code=400,
                detail="Could not extract text from PDF. It may be a scanned image PDF."
            )
        return full_text

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to read PDF: {str(e)}"
        )


def chunk_text(text: str, chunk_size: int = 300, overlap: int = 50) -> List[str]:
    """Split text into overlapping chunks"""
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i: i + chunk_size])
        chunks.append(chunk)
        i += chunk_size - overlap
    return [c for c in chunks if len(c.strip()) > 30]


def embed(texts: List[str]) -> np.ndarray:
    """Convert texts to normalized vectors"""
    vectors = embedder.encode(texts, convert_to_numpy=True)
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    normalized = vectors / (norms + 1e-9)
    return normalized.astype("float32")


def retrieve(query: str, top_k: int = 4) -> List[dict]:
    """Find most relevant chunks for a query"""
    if index.ntotal == 0:
        return []

    q_vec = embed([query])
    scores, positions = index.search(q_vec, min(top_k, index.ntotal))

    results = []
    for score, pos in zip(scores[0], positions[0]):
        if pos == -1:
            continue
        chunk_data = metadata_store[pos]
        results.append({
            "text": chunk_data["text"],
            "source": chunk_data["source"],
            "score": float(score),
        })
    return results


def build_rag_prompt(query: str, chunks: List[dict]) -> str:
    """Build prompt with document context"""
    context_parts = []
    for i, chunk in enumerate(chunks, 1):
        context_parts.append(
            f"[Source {i} — {chunk['source']}]\n{chunk['text']}"
        )
    context = "\n\n---\n\n".join(context_parts)

    return f"""You are a helpful assistant. Answer ONLY using the context below.
If the answer is not in the context, say: "I couldn't find that in the uploaded documents."
Always cite sources as [Source 1], [Source 2], etc.

CONTEXT:
{context}

USER QUESTION:
{query}"""


# ================================================================
#  API ROUTES
# ================================================================

@app.get("/health")
def health():
    return {
        "status": "ok",
        "chunks_indexed": index.ntotal,
        "documents": list({m["source"] for m in metadata_store}),
        "model": "llama-3.1-8b-instant (Groq)",
    }


@app.post("/ingest/file")
async def ingest_file(file: UploadFile = File(...)):
    """Accept PDF, TXT, MD files and index them"""
    filename = file.filename
    file_bytes = await file.read()

    if filename.lower().endswith(".pdf"):
        content = extract_text_from_pdf(file_bytes)

    elif filename.lower().endswith((".txt", ".md")):
        content = file_bytes.decode("utf-8", errors="ignore")

    else:
        raise HTTPException(
            status_code=400,
            detail="Only .pdf, .txt, and .md files are supported."
        )

    chunks = chunk_text(content)
    if not chunks:
        raise HTTPException(status_code=400, detail="No text found in file.")

    vectors = embed(chunks)
    index.add(vectors)

    for chunk in chunks:
        metadata_store.append({
            "text": chunk,
            "source": filename,
        })

    return {
        "message": f"Ingested {len(chunks)} chunks from '{filename}'",
        "total_indexed": index.ntotal,
    }


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    """Main RAG chat endpoint using Groq"""

    # Step 1: Retrieve relevant chunks
    chunks = retrieve(req.message, top_k=req.top_k)
    sources = list({c["source"] for c in chunks})

    # Step 2: Build messages list
    messages = []

    # System message
    messages.append({
        "role": "system",
        "content": (
            "You are a helpful AI assistant. "
            "Answer questions based on provided document context. "
            "Be concise, accurate, and always cite your sources."
        ),
    })

    # Conversation history
    for msg in req.history[-8:]:
        messages.append({
            "role": msg.role,
            "content": msg.content,
        })

    # RAG augmented user message
    if chunks:
        user_content = build_rag_prompt(req.message, chunks)
    else:
        user_content = (
            req.message
            + "\n\n(No documents uploaded yet. Please upload a file first.)"
        )

    messages.append({"role": "user", "content": user_content})

    # Step 3: Call Groq
    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=messages,
        max_tokens=1024,
        temperature=0.3,
    )

    answer = response.choices[0].message.content

    return ChatResponse(
        answer=answer,
        sources=sources,
        chunks_used=len(chunks),
    )


@app.delete("/vectorstore")
def clear_vectorstore():
    global index, metadata_store
    index = faiss.IndexFlatIP(EMBED_DIM)
    metadata_store.clear()
    return {"message": "Vector store cleared."}