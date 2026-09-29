FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FRONTEND_DIR=/frontend \
    UPLOAD_DIR=/app/uploads \
    REPORT_DIR=/app/reports

RUN apt-get update \
    && apt-get install -y --no-install-recommends libglib2.0-0 libgl1 fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
COPY backend /app
COPY frontend /frontend
RUN mkdir -p /app/uploads /app/reports

EXPOSE 8000
CMD ["python", "-m", "app.startup"]
