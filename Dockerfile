FROM node:14

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY dist ./dist
COPY public ./public

EXPOSE 4000

CMD ["node", "dist/index.js"]
