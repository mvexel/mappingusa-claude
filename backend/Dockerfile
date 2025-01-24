# Use an official lightweight Python image
FROM python:3.12-slim

# Set environment variables
ENV POETRY_VERSION=1.8.3 \
    POETRY_VIRTUALENVS_CREATE=false \
    PYTHONUNBUFFERED=1

# Install system dependencies and Poetry
RUN apt-get update && apt-get install -y curl && \
    curl -sSL https://install.python-poetry.org | python3 - && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Add Poetry to PATH
ENV PATH="/root/.local/bin:$PATH"

# Copy dependency files first (for caching)
COPY pyproject.toml poetry.lock ./

# Install dependencies
RUN poetry install --no-root --only main

# Copy application code
COPY . .

# Expose Flask's default port (change if needed)
EXPOSE 5000

# Run the application
CMD ["waitress-serve", "--port=5000", "app:app"]
