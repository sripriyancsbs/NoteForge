# =============================================================================
# Production Dockerfile for NOTEForge
# Multi-stage, lean, secure non-root image
# =============================================================================

# Build stage
FROM python:3.12-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Final runtime stage
FROM python:3.12-slim AS runner

WORKDIR /app

# Install runtime dependencies including curl for container HEALTHCHECK
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Create dedicated non-root user and group
RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser

# Copy installed python packages from builder
COPY --from=builder /root/.local /home/appuser/.local
ENV PYTHONUSERBASE=/home/appuser/.local
ENV PATH=/home/appuser/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Copy application source code
COPY --chown=appuser:appuser app /app/app
COPY --chown=appuser:appuser scripts /app/scripts

# Switch to non-root user
USER appuser

EXPOSE 5000

# Built-in health check probing the Flask /health endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Launch with production Gunicorn WSGI server
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "3", "--threads", "2", "--no-control-socket", "--access-logfile", "-", "--error-logfile", "-", "app.app:create_app()"]
