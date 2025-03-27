# Stage 1: Build the frontend assets
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy frontend source code and webpack config
COPY frontend/src ./frontend/src
COPY webpack.config.js ./

# Build frontend assets
RUN npm run build

# Stage 2: Setup the production environment
FROM node:20-alpine

WORKDIR /app

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy backend source code
COPY backend/src ./backend/src

# Copy built frontend assets from the builder stage
COPY --from=builder /app/frontend/dist ./frontend/dist

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["node", "backend/src/server.js"]