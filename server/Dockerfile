FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install --production

# Copy source files
COPY *.js ./

# Create data directory
RUN mkdir -p /app/data

# Environment variables
ENV NODE_ENV=production
ENV PORT=3456
ENV DATA_DIR=/app/data

# Expose port
EXPOSE 3456

# Run the server
CMD ["node", "index.js"]
