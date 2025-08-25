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

# Define the /summary endpoint
@app.get("/summary")
def get_summary(month: str):
    # This is mock data, as specified for Day 2 [cite: 59]
    # You will replace this with real database queries later.
    mock_response = {
        "month": month, # Use the month from the query parameter
        "totals": { "income": 5000, "expense": 2250.75, "net": 2749.25 },
        "byCategory": {
            "Food": 850.50,
            "Rent": 1200,
            "Utilities": 150.25,
            "Transport": 50
        },
        "daily": [
            {"date": f"{month}-01", "total": 1200},
            {"date": f"{month}-03", "total": 55.25},
            {"date": f"{month}-05", "total": 150.25},
            {"date": f"{month}-10", "total": 795.25}
        ]
    }
    return mock_response