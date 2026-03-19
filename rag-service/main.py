import os
import uuid
from typing import List
from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
from dotenv import load_dotenv
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from knowledge_base import (
    get_retriever,
    create_vector_db,
    add_documents_to_db,
    get_chroma_client,
    COLLECTION_NAME,
)
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()
# Global retriever instance
retriever = None

app = FastAPI(
    title="RAG Service API",
    description="Knowledge base management for helpdesk AI",
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """
    Runs automatically when FastAPI server starts.
    Connects to ChromaDB and initializes retriever.
    Same as your company's startup_event()
    """
    global retriever
    print("Starting RAG Service...")
    
    try:
        # Step 1: Create collection if not exists
        create_vector_db()
        
        # Step 2: Initialize retriever
        retriever = get_retriever()
        
        print("ChromaDB connected successfully!")
        print("Retriever initialized!")
        
    except Exception as e:
        print(f"ChromaDB connection failed: {e}")
        print("Service starting without retriever...")
        retriever = None
        
# ─── Pydantic Models ────────────────────────────────────────────
class QueryRequest(BaseModel):
    query: str

class ContextResponse(BaseModel):
    context: str

class AddDocumentRequest(BaseModel):
    content: str
    metadata: dict = {}        

# ─── Endpoints ─────────────────────────────────────────────────

@app.get("/")
async def root():
    """
    Root endpoint — health check.
    Just confirms service is running.
    """
    return {
        "message": "RAG Service is running!",
        "version": "1.0.0",
        "status": "healthy"
    }


@app.get("/health")
async def health():
    """
    Detailed health check.
    Shows if ChromaDB is connected or not.
    """
    return {
        "status": "healthy",
        "retriever": "connected" if retriever else "disconnected",
    }
@app.post("/retrieve", response_model=ContextResponse)
async def retrieve_context(request: QueryRequest):
    """
    Main RAG endpoint.
    Called by Next.js agents when user asks a question.
    
    Flow:
    1. Agent sends user question
    2. We search ChromaDB for relevant docs
    3. Return matching context to agent
    4. Agent sends context + question to LLM
    5. LLM gives accurate answer
    """
    # Check if ChromaDB is connected
    if retriever is None:
        raise HTTPException(
            status_code=503,
            detail="Vector database not available."
        )

    try:
        # Search ChromaDB for relevant documents
        docs = retriever.invoke(request.query)
        
        # If no documents found return empty
        if not docs:
            return ContextResponse(context="")

        # Combine all documents into one context string
        context = "\n\n".join(doc.page_content for doc in docs)
        
        return ContextResponse(context=context)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))    
    
@app.post("/add-document")
async def add_document(request: AddDocumentRequest):
    """
    Add a text document to knowledge base manually.
    Used for adding IT support articles as plain text.
    
    Flow:
    1. Admin sends text content
    2. We split into chunks
    3. Store chunks in ChromaDB
    4. Reload retriever
    """
    try:
        # Step 1: Split text into chunks
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=50
        )
        
        docs = splitter.create_documents(
            texts=[request.content],
            metadatas=[request.metadata]
        )

        # Step 2: Generate unique IDs for each chunk
        ids = [str(uuid.uuid4()) for _ in docs]
        
        # Step 3: Store in ChromaDB
        add_documents_to_db(docs, ids)

        # Step 4: Reload retriever with new docs
        global retriever
        retriever = get_retriever()

        return {
            "message": f"Successfully added to knowledge base!",
            "chunks": len(docs)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Upload PDF or TXT file to knowledge base.
    
    Flow:
    1. Admin uploads PDF/TXT file
    2. We save it temporarily
    3. Extract text from file
    4. Split into chunks
    5. Store in ChromaDB
    6. Delete temp file
    """
    try:
        import tempfile
        import shutil

        # Step 1: Save uploaded file temporarily
        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        # Step 2: Load document based on file type
        if suffix.lower() == ".pdf":
            from langchain_community.document_loaders import PyPDFLoader
            loader = PyPDFLoader(tmp_path)
        else:
            from langchain_community.document_loaders import TextLoader
            loader = TextLoader(tmp_path)

        documents = loader.load()

        # Step 3: Split into chunks
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=50
        )
        chunks = splitter.split_documents(documents)

        # Step 4: Add metadata to each chunk
        file_id = str(uuid.uuid4())
        for i, chunk in enumerate(chunks):
            chunk.metadata.update({
                "filename": file.filename,
                "file_id": file_id,
                "chunk_index": i,
                "total_chunks": len(chunks),
                "type": "uploaded_file"
            })

        # Step 5: Generate IDs
        ids = [
            f"{file.filename}-{file_id}-{i}"
            for i in range(len(chunks))
        ]

        # Step 6: Store in ChromaDB
        add_documents_to_db(chunks, ids)

        # Step 7: Reload retriever
        global retriever
        retriever = get_retriever()

        # Step 8: Delete temp file
        os.unlink(tmp_path)

        return {
            "message": f"Successfully uploaded {file.filename}",
            "chunks": len(chunks),
            "file_id": file_id
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/documents")
async def list_documents():
    """
    List all documents in knowledge base.
    Called by My KBs page to show all KB documents.
    """
    try:
        client = get_chroma_client()
        
        # Try to get collection
        try:
            collection = client.get_collection(name=COLLECTION_NAME)
        except Exception:
            # Collection doesn't exist yet
            return {"documents": [], "total_count": 0}

        # Get all documents
        result = collection.get(
            include=["documents", "metadatas"]
        )

        documents = []
        if result.get("ids"):
            for i, doc_id in enumerate(result["ids"]):
                documents.append({
                    "id": doc_id,
                    "content": result["documents"][i] if result.get("documents") else "",
                    "metadata": result["metadatas"][i] if result.get("metadatas") else {}
                })

        return {
            "documents": documents,
            "total_count": len(documents)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/documents/{document_id}")
async def delete_document(document_id: str):
    """
    Delete a specific document by ID.
    Called when user clicks delete in My KBs page.
    """
    try:
        client = get_chroma_client()
        collection = client.get_collection(name=COLLECTION_NAME)

        # Delete the document
        collection.delete(ids=[document_id])

        # Reload retriever
        global retriever
        retriever = get_retriever()

        return {"message": f"Document deleted successfully."}

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting document: {str(e)}"
        )    

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8002, reload=True)
