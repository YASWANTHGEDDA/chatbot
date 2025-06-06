FROM python:3.9-slim-buster

WORKDIR /app

# Install isolate sandbox
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    sudo \
    curl && \
    curl -L https://github.com/ioi/isolate/releases/download/v1.0.0/isolate-linux-x86_64 > /usr/local/bin/isolate && \
    chmod +x /usr/local/bin/isolate && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]