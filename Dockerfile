FROM python:3.11-slim

# Install tesseract and its English data at build time
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       tesseract-ocr \
       tesseract-ocr-eng \
       libtesseract-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py .

# Render injects $PORT at runtime; default to 8765 for local docker run
ENV PORT=8765

CMD gunicorn -b 0.0.0.0:$PORT server:app
