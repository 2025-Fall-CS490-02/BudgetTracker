import csv
import io
import hashlib
import datetime
from google.cloud import firestore
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware


# Initialize the Firestore client
# It will automatically find our credentials from the environment variable
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
    # Step 1: Query Firestore
    # Get a reference to the 'transactions' collection
    transactions_ref = db.collection('transactions')
    
    # Create a query to get all documents for the specified month
    query = transactions_ref.where("month", "==", month)
    docs = query.stream()

    # Step 2: Process the data
    total_inflow = 0
    total_outflow = 0
    by_category = {}

    for doc in docs:
        transaction = doc.to_dict()
        amount_cents = transaction.get("amount_cents", 0)
        
        if amount_cents > 0:
            total_inflow += amount_cents
        else:
            total_outflow += amount_cents # amount is already negative
            category = transaction.get("category", "Uncategorized")
            # Add the expense to its category (use positive value for summing)
            by_category[category] = by_category.get(category, 0) + abs(amount_cents)

    # Convert from cents to dollars for the response
    total_inflow_dollars = total_inflow / 100
    total_outflow_dollars = abs(total_outflow / 100) # Show as a positive number
    net_dollars = (total_inflow + total_outflow) / 100
    
    by_category_dollars = {cat: amount / 100 for cat, amount in by_category.items()}

    # Step 3: Return the response in the correct format
    summary_data = {
        "month": month,
        "totals": {
            "income": total_inflow_dollars,
            "expense": total_outflow_dollars,
            "net": net_dollars
        },
        "byCategory": by_category_dollars,
        # Daily data can be a future enhancement; return an empty list for now
        "daily": [] 
    }
    
    return summary_data


@app.post("/import/csv")
async def import_csv(file: UploadFile = File(...)):
    # Initialize counters
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
            # INITIAL LOGIC: Handle amounts
            amount = 0.0
            
            # REVISED LOGIC: Handle amounts more robustly
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

            # Create deduplication hash
            amount_in_cents = int(amount * 100)
            hash_input = f"{date}|{description}|{amount_in_cents}"
            dedupe_hash = hashlib.md5(hash_input.encode('utf-8')).hexdigest()

            # Check for duplicates IN FIRESTORE
            doc_ref = transactions_ref.document(dedupe_hash) # [cite: 126]
            if doc_ref.get().exists:
                skipped_count += 1
                continue
            
            # Prepare data and write to Firestore
            transaction_data = {
                "date_iso": date, # [cite: 127]
                "month": date[:7], # Extracts "YYYY-MM" [cite: 127]
                "description": description, # [cite: 127]
                "amount_cents": amount_in_cents, # [cite: 127]
                "category": description, # Default category [cite: 127]
                "created_at": datetime.datetime.now(datetime.timezone.utc) # [cite: 127]
            }
            doc_ref.set(transaction_data) # Write to Firestore
            
            imported_count += 1
        except (ValueError, KeyError) as e:
            errors_count += 1

    return {"imported": imported_count, "skipped": skipped_count, "errors": errors_count}