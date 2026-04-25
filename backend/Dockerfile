FROM python:3.11-slim

WORKDIR /srv
ENV PIP_DEFAULT_TIMEOUT=1000
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV PIP_PROGRESS_BAR=off

COPY requirements.txt /tmp/requirements.txt
COPY wheelhouse /tmp/wheelhouse

RUN set -eux; \
    if ls /tmp/wheelhouse/*.whl >/dev/null 2>&1; then \
        pip install --no-cache-dir --no-deps /tmp/wheelhouse/*.whl; \
    fi; \
    if [ -f /tmp/wheelhouse/.complete ]; then \
        pip install --no-cache-dir --no-index --find-links /tmp/wheelhouse -r /tmp/requirements.txt; \
    else \
        pip install --no-cache-dir --retries 20 --timeout 1200 -r /tmp/requirements.txt; \
    fi

COPY . /srv/backend

WORKDIR /srv/backend
ENV PYTHONPATH=/srv/backend

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
