FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY --chown=node:node . .

RUN mkdir -p /app/data /app/credentials \
    && chown -R node:node /app/data /app/credentials

USER node

EXPOSE 3000
CMD ["npm", "start"]
