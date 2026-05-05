# ================================================================
#  EMB RAG Chatbot — Backend
#  FastAPI + FAISS + sentence-transformers + Groq + Supabase Auth
# ================================================================

import os
import io
from typing import List
from datetime import datetime, timezone
from dotenv import load_dotenv
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
from groq import Groq
from supabase import create_client, Client
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import secrets

# ── Load environment variables ────────────────────────────────────
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY not found in .env")
if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL not found in .env")
if not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_KEY not found in .env")

# ── Groq client ───────────────────────────────────────────────────
groq_client = Groq(api_key=GROQ_API_KEY)

# ── Supabase client ───────────────────────────────────────────────
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Embedding model ───────────────────────────────────────────────
print("Loading embedding model...")
embedder = SentenceTransformer("all-MiniLM-L6-v2")
EMBED_DIM = 384

# ── FAISS index ───────────────────────────────────────────────────
index = faiss.IndexFlatIP(EMBED_DIM)
metadata_store: List[dict] = []

# ── Active sessions ───────────────────────────────────────────────
active_sessions = {}

DEV_USERS = {
    "EMB001": "123456",
    "EMB002": "654321",
    "EMB003": "111222",
}

# ── FastAPI app ───────────────────────────────────────────────────
app = FastAPI(title="EMB RAG Chatbot")

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

# ── Request/Response models ───────────────────────────────────────
class LoginRequest(BaseModel):
    user_id: str
    passcode: str

class SignupRequest(BaseModel):
    user_id: str
    passcode: str

class UserLookupRequest(BaseModel):
    user_id: str

class ResetPasswordRequest(BaseModel):
    user_id: str
    new_passcode: str

class LoginResponse(BaseModel):
    success: bool
    token: str
    message: str

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
#  AUTH FUNCTIONS
# ================================================================

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    if token not in active_sessions:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired session. Please login again."
        )
    return active_sessions[token]


def get_supabase_users(user_id: str, columns: str = "*") -> List[dict]:
    try:
        result = supabase.table("users").select(columns).eq(
            "user_id", user_id
        ).execute()

        if not result.data:
            result = supabase.table("users").select(columns).ilike(
                "user_id", user_id
            ).execute()

        return result.data or []
    except Exception as e:
        print(f"Could not check Supabase users: {e}")
        return []


def user_exists(user_id: str) -> bool:
    return bool(get_supabase_users(user_id, "user_id")) or user_id in DEV_USERS


# ================================================================
#  RAG HELPER FUNCTIONS
# ================================================================

def extract_text_from_pdf(file_bytes: bytes) -> str:
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
                detail="Could not extract text. PDF may be image-based."
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
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i: i + chunk_size])
        chunks.append(chunk)
        i += chunk_size - overlap
    return [c for c in chunks if len(c.strip()) > 30]


def embed(texts: List[str]) -> np.ndarray:
    vectors = embedder.encode(texts, convert_to_numpy=True)
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    normalized = vectors / (norms + 1e-9)
    return normalized.astype("float32")


def retrieve(query: str, top_k: int = 4) -> List[dict]:
    if index.ntotal == 0:
        return []
    q_vec = embed([query])
    scores, positions = index.search(q_vec, min(top_k, index.ntotal))
    results = []
    for score, pos in zip(scores[0], positions[0]):
        if pos == -1:
            continue
        results.append({
            "text": metadata_store[pos]["text"],
            "source": metadata_store[pos]["source"],
            "score": float(score),
        })
    return results


def build_rag_prompt(query: str, chunks: List[dict]) -> str:
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
        "model": "llama-3.1-8b-instant (Groq)",
    }


@app.post("/signup")
def signup(req: SignupRequest):
    try:
        user_id = req.user_id.strip().upper()
        passcode = req.passcode.strip()

        if not user_id:
            raise HTTPException(status_code=400, detail="User ID is required.")
        if len(passcode) != 6 or not passcode.isdigit():
            raise HTTPException(status_code=400, detail="Passcode must be 6 digits.")

        if user_exists(user_id):
            raise HTTPException(status_code=409, detail="User ID already exists.")

        try:
            supabase.table("users").insert({
                "user_id": user_id,
                "passcode": passcode,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
        except Exception as e:
            print(f"Could not save signup to Supabase, using local dev user: {e}")

        DEV_USERS[user_id] = passcode

        return {
            "success": True,
            "message": "Signup successful. Please login.",
            "user_id": user_id,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/forgot-password")
def forgot_password(req: UserLookupRequest):
    try:
        user_id = req.user_id.strip().upper()

        if not user_id:
            raise HTTPException(status_code=400, detail="User ID is required.")

        if not user_exists(user_id):
            raise HTTPException(status_code=404, detail="User ID not found.")

        return {
            "success": True,
            "message": "User found. You can reset your passcode now.",
            "user_id": user_id,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/reset-password")
def reset_password(req: ResetPasswordRequest):
    try:
        user_id = req.user_id.strip().upper()
        new_passcode = req.new_passcode.strip()

        if not user_id:
            raise HTTPException(status_code=400, detail="User ID is required.")
        if len(new_passcode) != 6 or not new_passcode.isdigit():
            raise HTTPException(status_code=400, detail="New passcode must be 6 digits.")
        if not user_exists(user_id):
            raise HTTPException(status_code=404, detail="User ID not found.")

        supabase_users = get_supabase_users(user_id, "user_id")
        if supabase_users:
            try:
                supabase.table("users").update({
                    "passcode": new_passcode,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }).eq("user_id", supabase_users[0]["user_id"]).execute()
            except Exception as e:
                print(f"Could not reset passcode in Supabase, using local dev user: {e}")

        DEV_USERS[user_id] = new_passcode

        return {
            "success": True,
            "message": "Passcode reset successful. Please login.",
            "user_id": user_id,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/login", response_model=LoginResponse)
def login(req: LoginRequest):
    try:
        user_id = req.user_id.strip().upper()
        passcode = req.passcode.strip()

        users = get_supabase_users(user_id)

        if users:
            user = users[0]

            if user["passcode"] != passcode:
                raise HTTPException(
                    status_code=401,
                    detail="Incorrect passcode."
                )

            try:
                supabase.table("users").update(
                    {"last_login": datetime.now(timezone.utc).isoformat()}
                ).eq("user_id", user["user_id"]).execute()
            except Exception as e:
                print(f"Could not update last_login: {e}")
        else:
            if DEV_USERS.get(user_id) != passcode:
                raise HTTPException(
                    status_code=401,
                    detail="User ID not found or incorrect passcode."
                )

        token = secrets.token_hex(32)
        active_sessions[token] = user_id

        return LoginResponse(
            success=True,
            token=token,
            message=f"Welcome {user_id}!"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/logout")
def logout(
    user_id: str = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials
    if token in active_sessions:
        del active_sessions[token]
    return {"message": "Logged out successfully"}


@app.post("/ingest/file")
async def ingest_file(
    file: UploadFile = File(...),
    user_id: str = Depends(verify_token)
):
    filename = file.filename
    file_bytes = await file.read()

    if filename.lower().endswith(".pdf"):
        content = extract_text_from_pdf(file_bytes)
    elif filename.lower().endswith((".txt", ".md")):
        content = file_bytes.decode("utf-8", errors="ignore")
    else:
        raise HTTPException(
            status_code=400,
            detail="Only .pdf, .txt, and .md files supported."
        )

    chunks = chunk_text(content)
    if not chunks:
        raise HTTPException(
            status_code=400,
            detail="No text found in file."
        )

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
def chat(
    req: ChatRequest,
    user_id: str = Depends(verify_token)
):
    chunks = retrieve(req.message, top_k=req.top_k)
    sources = list({c["source"] for c in chunks})

    messages = []
    messages.append({
        "role": "system",
        "content": (
            "You are a helpful AI assistant. "
            "Answer questions based on provided document context. "
            "Be concise, accurate, and always cite your sources."
        ),
    })

    for msg in req.history[-8:]:
        messages.append({"role": msg.role, "content": msg.content})

    if chunks:
        user_content = build_rag_prompt(req.message, chunks)
    else:
        user_content = (
            req.message
            + "\n\n(No documents uploaded yet. Please upload a file first.)"
        )

    messages.append({"role": "user", "content": user_content})

    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=messages,
        max_tokens=1024,
        temperature=0.3,
    )

    return ChatResponse(
        answer=response.choices[0].message.content,
        sources=sources,
        chunks_used=len(chunks),
    )


@app.delete("/vectorstore")
def clear_vectorstore(user_id: str = Depends(verify_token)):
    global index, metadata_store
    index = faiss.IndexFlatIP(EMBED_DIM)
    metadata_store.clear()
    return {"message": "Vector store cleared."}
