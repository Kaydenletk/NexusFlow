FROM node:24-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/focus-core/package.json packages/focus-core/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @quantified-self/contracts build \
  && pnpm --filter @nexusflow/focus-core build \
  && pnpm --filter @quantified-self/db build \
  && pnpm --filter @quantified-self/api build

EXPOSE 3001
