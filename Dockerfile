FROM oven/bun:latest

WORKDIR /app


COPY package.json bun.lock tsconfig.json ./
COPY . .

RUN bun i

RUN bunx prisma generate


EXPOSE 9099

CMD ["bun", "start"]