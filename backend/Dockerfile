FROM python:3.11-slim

WORKDIR /srv
ENV PIP_DEFAULT_TIMEOUT=1000
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV PIP_PROGRESS_BAR=off

COPY requirements.txt /tmp/requirements.txt

RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    portaudio19-dev \
    libasound2-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir --retries 20 --timeout 1200 -r /tmp/requirements.txt

COPY . /srv/backend

WORKDIR /srv/backend
ENV PYTHONPATH=/srv/backend

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
