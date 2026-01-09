FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all backend code
COPY backend/ .

# Run uvicorn (production-friendly by default; enable reload via docker-compose for local dev)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
