# ================================================================
#  EMB RAG Chatbot — Backend
#  FastAPI + FAISS + sentence-transformers + OpenRouter + Supabase Auth
# ================================================================

import os
import io
import json
import re
import unicodedata
from typing import List
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
import requests
from supabase import create_client, Client
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import secrets

# ── Load environment variables ────────────────────────────────────
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=True)
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openrouter/free")
OPENROUTER_SITE_URL = os.getenv("OPENROUTER_SITE_URL")
OPENROUTER_APP_NAME = os.getenv("OPENROUTER_APP_NAME", "EMB RAG Chatbot")
OPENROUTER_DATETIME_TIMEZONE = os.getenv("OPENROUTER_DATETIME_TIMEZONE", "Asia/Kolkata")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

if not OPENROUTER_API_KEY:
    raise RuntimeError("OPENROUTER_API_KEY not found in .env")
if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL not found in .env")
if not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_KEY not found in .env")

# ── OpenRouter client ─────────────────────────────────────────────
OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"

openrouter_headers = {
    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
    "Content-Type": "application/json",
    "X-Title": OPENROUTER_APP_NAME,
}
if OPENROUTER_SITE_URL:
    openrouter_headers["HTTP-Referer"] = OPENROUTER_SITE_URL

WEB_SEARCH_TOOL = {
    "type": "openrouter:web_search",
    "parameters": {
        "engine": "auto",
        "max_results": 2,
        "max_total_results": 2,
        "search_context_size": "low",
    },
}

DATE_TIME_KEYWORDS = (
    "date",
    "time",
    "today",
    "tomorrow",
    "yesterday",
    "day",
    "month",
    "year",
    "timezone",
    "current time",
    "current date",
)

WEB_SEARCH_KEYWORDS = (
    "latest",
    "recent",
    "news",
    "search",
    "web",
    "internet",
    "online",
    "live",
    "current",
    "today's",
    "today ",
    "now",
)


def wants_datetime_tool(text: str) -> bool:
    lowered = f" {text.lower()} "
    return any(keyword in lowered for keyword in DATE_TIME_KEYWORDS)


def wants_web_search_tool(text: str) -> bool:
    lowered = f" {text.lower()} "
    if wants_datetime_tool(text) and not any(word in lowered for word in (" latest", " news", " search", " web", " internet", " recent", " live")):
        return False
    return any(keyword in lowered for keyword in WEB_SEARCH_KEYWORDS)


def select_openrouter_tools(user_message: str) -> List[dict]:
    tools = []
    if wants_web_search_tool(user_message):
        tools.append(WEB_SEARCH_TOOL)
    return tools


def get_current_datetime_tool() -> str:
    if OPENROUTER_DATETIME_TIMEZONE.lower() in ("asia/kolkata", "asia/calcutta", "ist"):
        tz = timezone(timedelta(hours=5, minutes=30), name="IST")
    else:
        tz = timezone.utc
    now = datetime.now(tz)
    return now.strftime("%A, %B %d, %Y at %I:%M %p %Z")


def clean_llm_answer(answer: str) -> str:
    answer = answer.strip()
    answer = unicodedata.normalize("NFKC", answer)
    answer = answer.translate(str.maketrans({
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2013": "-",
        "\u2014": "-",
        "\u202f": " ",
        "\u00a0": " ",
    }))
    answer = re.sub(r"【[^】]*】", "", answer)
    answer = re.sub(r"ã.*?ã", "", answer)
    answer = re.sub(r"[ \t]+\n", "\n", answer)
    answer = re.sub(r"\n{3,}", "\n\n", answer)
    return answer.strip()


def call_openrouter(messages: List[dict], tools: List[dict] | None = None) -> str:
    payload = {
        "model": OPENROUTER_MODEL,
        "messages": messages,
        "max_tokens": 1024,
        "temperature": 0.3,
    }
    if tools:
        payload["tools"] = tools

    try:
        response = requests.post(
            OPENROUTER_CHAT_URL,
            headers=openrouter_headers,
            data=json.dumps(payload),
            timeout=60,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"OpenRouter request failed: {exc}") from exc

    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"OpenRouter error {response.status_code}: {response.text[:500]}",
        )

    data = response.json()
    try:
        return clean_llm_answer(data["choices"][0]["message"]["content"] or "")
    except (KeyError, IndexError, TypeError) as exc:
        raise HTTPException(status_code=502, detail="Unexpected OpenRouter response.") from exc

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
    allow_origin_regex=r"https://.*\.pages\.dev|http://localhost:\d+|http://127\.0\.0\.1:\d+",
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
        "model": f"{OPENROUTER_MODEL} (OpenRouter)",
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
    tools = select_openrouter_tools(req.message)

    if wants_datetime_tool(req.message) and not tools and not chunks:
        return ChatResponse(
            answer=f"The current date and time is **{get_current_datetime_tool()}**.",
            sources=[],
            chunks_used=0,
        )

    messages = []
    messages.append({
        "role": "system",
        "content": (
            "You are a helpful AI assistant. "
            "Answer questions based on provided document context. "
            "If tool context is provided, use that tool context directly. "
            "Be concise, accurate, and use clean markdown formatting. "
            "Use plain ASCII punctuation. "
            "For web search answers, start with the direct answer, then add 2-4 short bullets. "
            "Do not include bracketed citation markers such as [1], line numbers, or source snippets. "
            "Do not dump raw tool output."
        ),
    })

    if wants_datetime_tool(req.message):
        messages.append({
            "role": "system",
            "content": f"Current date/time tool result: {get_current_datetime_tool()}.",
        })

    for msg in req.history[-8:]:
        messages.append({"role": msg.role, "content": msg.content})

    if chunks:
        user_content = build_rag_prompt(req.message, chunks)
    elif tools or wants_datetime_tool(req.message):
        user_content = req.message
    else:
        user_content = (
            req.message
            + "\n\n(No documents uploaded yet. Please upload a file first.)"
        )

    messages.append({"role": "user", "content": user_content})

    answer = call_openrouter(messages, tools=tools)
    if not answer:
        answer = "I could not generate a response from the current OpenRouter model. Please try again."

    return ChatResponse(
        answer=answer,
        sources=sources,
        chunks_used=len(chunks),
    )


@app.delete("/vectorstore")
def clear_vectorstore(user_id: str = Depends(verify_token)):
    global index, metadata_store
    index = faiss.IndexFlatIP(EMBED_DIM)
    metadata_store.clear()
    return {"message": "Vector store cleared."}
