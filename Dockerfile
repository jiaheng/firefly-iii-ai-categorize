FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY ["package.json", "./"]
RUN npm install --omit=dev --strict-ssl=false
COPY . .
CMD ["node", "index.js"]