# Production Dockerfile for Threshold Backend with Playwright Support
FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Ensure Chromium browser is installed
RUN playwright install chromium

# Copy project code
COPY . .

# Expose port
EXPOSE 8000

# Run Uvicorn production server
CMD ["uvicorn", "web.api:app", "--host", "0.0.0.0", "--port", "8000"]
