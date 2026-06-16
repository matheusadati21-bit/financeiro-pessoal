FROM node:20-alpine

WORKDIR /app

COPY package.json ./

RUN npm config set registry https://registry.npmjs.org/ \
  && npm install --omit=dev --no-audit --no-fund

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
