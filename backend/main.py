from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Initialize the FastAPI app
app = FastAPI()

# Define the origins that are allowed to make requests
# In this case, it's our local React app's address
origins = [
    "http://localhost:5173",
]

# Add the CORS middleware to the app
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods
    allow_headers=["*"], # Allows all headers
)

# Define the /health endpoint
@app.get("/health")
def read_health():
    return {"ok": True}