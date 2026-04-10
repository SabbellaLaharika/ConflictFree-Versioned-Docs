# Stage 1: Build and Dependencies
FROM node:20 AS builder
WORKDIR /usr/src/app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Production environment
FROM node:20-slim
WORKDIR /usr/src/app

# Production dependencies only
COPY package*.json ./
RUN npm install --omit=dev

# Copy compiled code from builder
COPY --from=builder /usr/src/app/dist ./dist
# Note: Keeping src is optional for production but useful for ts-node debugging if needed
# For this project, we need it if we want to run seeding via ts-node, 
# although we can also run the compiled version.
COPY --from=builder /usr/src/app/src ./src

EXPOSE 3000

# Default command runs the production server
CMD ["npm", "start"]
