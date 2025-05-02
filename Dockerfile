FROM node:21.7.3
WORKDIR .
COPY package.json .
RUN corepack enable pnpm
RUN pnpm install
COPY . .
RUN pnpm run build
EXPOSE 8081

CMD [ "pnpm", "start" ]