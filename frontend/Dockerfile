# ============================================================
# ResolveX Frontend — Railway Dockerfile
# ============================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies (cached layer)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .

# VITE_API_BASE_URL will be passed as a build arg from Railway
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# ---- Serve with lightweight nginx ----
FROM nginx:1.27-alpine AS runner

# Install gettext for envsubst (to substitute $PORT at runtime)
RUN apk add --no-cache gettext

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config TEMPLATE (contains $PORT placeholder)
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Railway injects $PORT; this script substitutes it then starts nginx
EXPOSE 8080

CMD ["/bin/sh", "-c", "envsubst '$PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
