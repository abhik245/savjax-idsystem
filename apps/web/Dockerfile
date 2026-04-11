FROM node:20-bookworm-slim AS deps
WORKDIR /app

COPY apps/web/package*.json ./
RUN npm ci

FROM node:20-bookworm-slim AS build
WORKDIR /app

ARG NEXT_PUBLIC_API_BASE=https://api.savjax.com/api/v2
ARG NEXT_PUBLIC_EXPOSE_DEV_OTP=false
ARG NEXT_PUBLIC_EXPOSE_DEV_AUTH_HINTS=false

ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
ENV NEXT_PUBLIC_EXPOSE_DEV_OTP=$NEXT_PUBLIC_EXPOSE_DEV_OTP
ENV NEXT_PUBLIC_EXPOSE_DEV_AUTH_HINTS=$NEXT_PUBLIC_EXPOSE_DEV_AUTH_HINTS

COPY --from=deps /app/node_modules ./node_modules
COPY apps/web/package*.json ./
COPY apps/web/tsconfig.json ./tsconfig.json
COPY apps/web/next-env.d.ts ./next-env.d.ts
COPY apps/web/next.config.mjs ./next.config.mjs
COPY apps/web/postcss.config.js ./postcss.config.js
COPY apps/web/tailwind.config.ts ./tailwind.config.ts
COPY apps/web/app ./app
COPY apps/web/components ./components
COPY apps/web/lib ./lib
COPY apps/web/pages ./pages
COPY apps/web/public ./public

RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
