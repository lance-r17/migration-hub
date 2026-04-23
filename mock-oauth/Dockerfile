FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir fastapi uvicorn pydantic python-multipart --break-system-packages

COPY main.py /app/main.py

EXPOSE 5557

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5557"]
