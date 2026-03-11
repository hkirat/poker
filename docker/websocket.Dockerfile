FROM oven/bun:1

WORKDIR /app

COPY . .

RUN bun install

WORKDIR /app/apps/websocket

EXPOSE 3001

CMD ["bun", "run", "dev"]