import csv
import io
import hashlib
import datetime
from google.cloud import firestore
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware


# Initialize the Firestore client
# It will automatically find your credentials from the environment variable
db = firestore.Client()

# Initialize the FastAPI app
app = FastAPI()

# Define the origins that are allowed to make requests
# In this case, it's our local React app's address
origins = [
    "http://localhost:5173",
    "https://budgettracker-unfg.onrender.com",
    "https://budget-tracker-rho-eight.vercel.app",
    "https://budget-tracker-nxbvxm7aa-ezequiels-projects-0cc64712.vercel.app",
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
    # We will replace this with real database queries later.
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


@app.post("/import/csv")
async def import_csv(file: UploadFile = File(...)):
    # ... (keep your counters and file reading logic) ...
    imported_count = 0
    skipped_count = 0
    errors_count = 0
    
    # Use a set to track hashes for the current upload to avoid duplicates within the same file
    processed_hashes = set()

    # Read the uploaded file content
    contents = await file.read()
    # Use io.StringIO to treat the byte string as a text file
    file_stream = io.StringIO(contents.decode("utf-8"))
    
    reader = csv.DictReader(file_stream)
    transactions_ref = db.collection('transactions') # [cite: 125]
    
    for row in reader:
        try:
            # ... (keep your robust amount parsing logic) ...
            amount = 0.0
            
            # --- REVISED LOGIC: Handle amounts more robustly ---
            if row.get('amount') and row['amount'].strip():
                # Clean and convert the primary amount column
                amount_str = row['amount'].strip().replace('$', '').replace(',', '')
                amount = float(amount_str)
            elif row.get('debit') and row['debit'].strip():
                # Clean, convert, and ensure the value is negative
                debit_str = row['debit'].strip().replace('$', '').replace(',', '')
                amount = -abs(float(debit_str))
            elif row.get('credit') and row['credit'].strip():
                # Clean, convert, and ensure the value is positive
                credit_str = row['credit'].strip().replace('$', '').replace(',', '')
                amount = abs(float(credit_str))
            else:
                # If no amount can be found, this row is invalid
                raise ValueError("No valid amount, debit, or credit value found in row")

            date = row.get('date', '')
            description = row.get('description', '').strip().lower()

            # --- Create deduplication hash ---
            amount_in_cents = int(amount * 100)
            hash_input = f"{date}|{description}|{amount_in_cents}"
            dedupe_hash = hashlib.md5(hash_input.encode('utf-8')).hexdigest()

            # --- Check for duplicates IN FIRESTORE ---
            doc_ref = transactions_ref.document(dedupe_hash) # [cite: 126]
            if doc_ref.get().exists:
                skipped_count += 1
                continue
            
            # --- Prepare data and write to Firestore ---
            transaction_data = {
                "date_iso": date, # [cite: 127]
                "month": date[:7], # Extracts "YYYY-MM" [cite: 127]
                "description": description, # [cite: 127]
                "amount_cents": amount_in_cents, # [cite: 127]
                "category": "Uncategorized", # Default category [cite: 127]
                "created_at": datetime.datetime.now(datetime.timezone.utc) # [cite: 127]
            }
            doc_ref.set(transaction_data) # Write to Firestore
            
            imported_count += 1
        except (ValueError, KeyError) as e:
            errors_count += 1

    return {"imported": imported_count, "skipped": skipped_count, "errors": errors_count}