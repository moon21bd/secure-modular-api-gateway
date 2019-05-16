FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev
RUN npm install -g nodemon

COPY db/ ./db

CMD ["nodemon", "./bin/www"]
