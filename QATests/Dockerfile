FROM python:3.11-slim

# System deps for Playwright/Chromium (Robot Framework Browser)
RUN apt-get update && apt-get install -y --no-install-recommends \
	ca-certificates \
	curl \
	wget \
	gnupg \
	nodejs \
	npm \
	libnss3 \
	libatk1.0-0 \
	libatk-bridge2.0-0 \
	libcups2 \
	libdrm2 \
	libxkbcommon0 \
	libxcomposite1 \
	libxdamage1 \
	libxfixes3 \
	libxrandr2 \
	libgbm1 \
	libpango-1.0-0 \
	libcairo2 \
	libasound2 \
	libxshmfence1 \
	libgtk-3-0 \
	libx11-xcb1 \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /opt/robotframework

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright + browser binaries for Robot Framework Browser.
# Needs write permissions to Browser/wrapper and needs npm, so run as root.
RUN rfbrowser init

# Create a non-root user
RUN useradd -ms /bin/bash robot
COPY . .
RUN chown -R robot:robot /opt/robotframework

USER robot

CMD ["robot", "--outputdir", "results", "--exclude", "legacy", "tests"]
