# ==============================================================================
# Dockerfile for Python Trip Planner V9 AI Engine
# ==============================================================================
FROM python:3.11-slim

WORKDIR /app

# Install curl for healthcheck and create non-root runtime user
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/* \
  && groupadd --system appgroup && useradd --system --gid appgroup --create-home appuser

# Copy data, engine and API scripts
COPY --chown=appuser:appgroup . .

ENV PYTHONUNBUFFERED=1

USER appuser

EXPOSE 8010

# Healthcheck against Python API endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8010/health || exit 1

# Start Python API bound inside isolated Docker network pointing to Valhalla service
CMD ["python", "web_api.py", "--host", "0.0.0.0", "--port", "8010", "--valhalla-url", "http://valhalla:8002"]
