FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    build-essential \
    postgresql-client \
    default-mysql-client \
    redis-tools \
    node-gyp \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js (required by Frappe)
RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*

# Copy Frappe framework (will be mounted as volume, but need it for build)
COPY frappe /app/frappe
WORKDIR /app/frappe

# Install Frappe dependencies (fail if installation fails)
RUN pip install --no-cache-dir -e . || (echo "Frappe installation failed!" && exit 1)

# Copy ERPNext app (will be mounted as volume, but need it for build)
COPY erpnext /app/erpnext
WORKDIR /app/erpnext

# Install ERPNext dependencies (fail if installation fails)
RUN pip install --no-cache-dir -e . || (echo "ERPNext installation failed!" && exit 1)

# Create custom apps directory
RUN mkdir -p /app/custom-apps

# Copy entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Expose port
EXPOSE 8000

# Set working directory
WORKDIR /app

# Use entrypoint script
ENTRYPOINT ["/app/entrypoint.sh"]
