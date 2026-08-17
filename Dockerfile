# Local container testing only — NOT the production deploy path.
#
# clockflux.app deploys via Vercel, which is where the real environment
# variables, CSP headers and rewrites live (vercel.json). This image exists to
# run the built app behind nginx locally; keeping it means keeping it honest,
# because a half-working alternate path invites someone to ship from it.
#
# It previously declared only VITE_GOOGLE_CLIENT_ID as a build arg, so
# VITE_API_URL was inlined by Vite as the literal `undefined` — producing a
# container that started cleanly, served a page that looked right, and issued
# `fetch("undefined/api/v1/auth/refresh")` for every call.
#
#   docker build \
#     --build-arg VITE_API_URL=http://localhost:8090 \
#     --build-arg VITE_GOOGLE_CLIENT_ID=... \
#     -t clockflux-front .
#
# --- Build stage ---
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite inlines these at build time, so they must be build args — an ENV set on
# the final image arrives far too late to affect the bundle.
ARG VITE_API_URL
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_ACCOUNT_URL
ARG VITE_INFO_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_ACCOUNT_URL=$VITE_ACCOUNT_URL
ENV VITE_INFO_URL=$VITE_INFO_URL

# Fails the build rather than shipping a bundle that calls `undefined/api/...`.
# npm run build also runs check-csp.mjs, which verifies the committed CSP
# actually allows this origin.
RUN test -n "$VITE_API_URL" || (echo "VITE_API_URL is required; see the header of this Dockerfile" && exit 1)

RUN npm run build

# --- Serve stage ---
FROM nginx:1.27-alpine AS serve

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# nginx's master process runs as root by default. The nginx:alpine image ships
# an unprivileged `nginx` user; these are the paths it needs to write, and the
# listen port has to move above 1024 since a non-root process can't bind 80.
# (The backend Dockerfile already does the equivalent with adduser/USER.)
RUN sed -i 's/listen 80;/listen 8080;/' /etc/nginx/conf.d/default.conf \
  && sed -i 's,^pid .*,pid /tmp/nginx.pid;,' /etc/nginx/nginx.conf \
  && chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /etc/nginx/conf.d

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q --spider http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]