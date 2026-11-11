FROM python:3.12-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install system dependencies required by TensorFlow, OpenCV, and Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user with uid 1000 (required by Hugging Face Spaces)
RUN useradd -m -u 1000 user

WORKDIR /app

# Install Python dependencies first for better Docker layer caching
COPY --chown=user:user requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend application code and ML model artifacts
COPY --chown=user:user . .

# Ensure upload directories exist and are writable by uid 1000
RUN mkdir -p /app/uploads/images /app/uploads/heatmaps && \
    chown -R user:user /app

USER user
ENV HOME=/home/user \
    PATH="/home/user/.local/bin:${PATH}"

EXPOSE 7860

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
