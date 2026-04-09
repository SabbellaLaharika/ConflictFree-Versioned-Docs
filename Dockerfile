FROM node:20

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build || echo "Build failed, but continuing for dev mode"

EXPOSE 3000

CMD ["npm", "run", "dev"]
