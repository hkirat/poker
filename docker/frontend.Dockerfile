FROM oven/bun:1

WORKDIR /app

COPY . .

RUN bun install

WORKDIR /app/apps/user-frontend

EXPOSE 5173

RUN bun run build
CMD ["bunx", "vite", "preview", "--host"]