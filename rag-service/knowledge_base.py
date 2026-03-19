import os
from dotenv import load_dotenv
import chromadb
from chromadb.config import Settings
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings


load_dotenv()

# Config
COLLECTION_NAME = "knowledge_base"
CHROMA_URL = os.getenv("CHROMA_URL", "localhost")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", 8001))
# CHROMA_TOKEN = os.getenv("CHROMA_TOKEN", "test-token")


def get_embeddings():
    '''
    Initialize HuggingFaceEmbeddings with the specified model.
    Returns HuggingFace embeddings model.
        - model_name: "sentence-transformers/all-MiniLM-L6-v2" is a compact model that provides good performance for semantic search tasks.
        - model_kwargs={"device": "cpu"} ensures that the model runs on the CPU, which is suitable
    '''
    return HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2",
        model_kwargs={"device": "cpu"}
        )

def get_chroma_client():
    """
    Its a chromadb database connection function that returns a ChromaDB HTTP client.
    Returns ChromaDB HTTP client.
    Connects to ChromaDB server running separately.
    Same as your company's get_chroma_client()
    """
    return chromadb.HttpClient(
        host=CHROMA_URL,
        port=CHROMA_PORT,
        # settings=Settings(
        #     chroma_client_auth_provider="chromadb.auth.token_authn.TokenAuthClientProvider",
        #     chroma_client_auth_credentials=CHROMA_TOKEN
        # )
    )
    
def create_vector_db():
    """
    Creates ChromaDB collection if it doesn't exist.
    Called once on startup.
    Same as your company's create_vector_db()
    """
    embeddings = get_embeddings()
    client = get_chroma_client()

    try:
        client.get_collection(name=COLLECTION_NAME)
        print(f"✅ Collection '{COLLECTION_NAME}' already exists.")
    except Exception:
        Chroma(
            client=client,
            collection_name=COLLECTION_NAME,
            embedding_function=embeddings,
        )
        print(f"✅ Created new collection: '{COLLECTION_NAME}'")

def get_retriever():
    """
    Initializes and returns a Chroma retriever.
    Same as your company's get_retriever()
    """
    embeddings = get_embeddings()
    client = get_chroma_client()

    return Chroma(
        client=client,
        collection_name=COLLECTION_NAME,
        embedding_function=embeddings,
    ).as_retriever(search_kwargs={"k": 2})
    
def add_documents_to_db(documents, ids):
    """
    Adds new documents to ChromaDB collection.
    Called when:
    - Uploading PDF/TXT files
    - Adding KB articles manually
    - Scraping websites for KB content
    Same as your company's add_documents_to_db()
    """
    embeddings = get_embeddings()
    client = get_chroma_client()

    db = Chroma(
        client=client,
        collection_name=COLLECTION_NAME,
        embedding_function=embeddings,
    )

    if documents:
        db.add_documents(documents, ids=ids)
        print(f"✅ Added {len(documents)} documents to KB.")                     
