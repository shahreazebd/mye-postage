FROM oven/bun:latest

WORKDIR /app


COPY package.json bun.lock tsconfig.json ./
COPY . .

RUN bun i

EXPOSE 9099

CMD ["bun", "start"]