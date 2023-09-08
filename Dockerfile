FROM node:14

WORKDIR /app

COPY package*.json ./
COPY tsconfig*.json ./
COPY src ./src


RUN npm install
RUN npm run build

COPY dist ./dist

EXPOSE 4000

CMD ["node", "dist/index.js"]
