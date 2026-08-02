# Stage 1: Build Frontend Assets
FROM node:20 AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Create Production Server
FROM node:20 AS backend-runner
WORKDIR /app

# Install Python and virtual environment
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Set up Python virtual environment and install AI engine requirements
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir numpy scikit-learn requests

# Copy backend files
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install

COPY backend/ ./

# Copy compiled frontend assets to backend public hosting folder
COPY --from=frontend-builder /app/frontend/dist ./public

# Setup prisma schema swapper and client
RUN node prisma-setup.js && npx prisma generate

EXPOSE 5000

ENV PORT=5000
ENV NODE_ENV=production

# Start application
CMD ["npm", "start"]
