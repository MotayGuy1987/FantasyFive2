# Use Node.js 18 (matches Railway's environment)
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first for Docker layer caching
COPY package*.json ./

# Clear npm cache and install dependencies
# Use --no-cache to avoid cache conflicts
RUN npm cache clean --force && \
    npm ci --prefer-offline --no-audit --no-fund

# Copy the rest of the source code
COPY . .

# Build the application
RUN npm run build

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Change ownership of the app directory
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port (Railway will set this via $PORT)
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
