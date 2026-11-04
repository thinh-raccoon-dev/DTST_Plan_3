# ==============================================================================
# Dockerfile for Python Trip Planner V9 AI Engine
# ==============================================================================
FROM python:3.11-slim

WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Copy data, engine and API scripts
COPY . .

ENV PYTHONUNBUFFERED=1

EXPOSE 8010

# Healthcheck against Python API endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8010/health || exit 1

# Start Python API pointing to Valhalla service in Docker network
CMD ["python", "web_api.py", "--port", "8010", "--valhalla-url", "http://valhalla:8002"]
