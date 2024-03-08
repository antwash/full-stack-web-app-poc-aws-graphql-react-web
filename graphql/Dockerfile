FROM node:18-alpine3.18 As development

WORKDIR /usr/src/app
COPY --chown=node:node package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY --chown=node:node . .
USER node

FROM node:18-alpine3.18 As build
WORKDIR /usr/src/app
ARG NODE_ENV
ARG PORT
COPY --chown=node:node package.json yarn.lock ./
COPY --chown=node:node --from=development /usr/src/app/node_modules ./node_modules
COPY --chown=node:node . .
ENV NODE_ENV ${NODE_ENV}
ENV PORT ${PORT}
EXPOSE ${PORT}
RUN yarn nx build graphql
RUN yarn install --production --frozen-lockfile && yarn cache clean
USER node

FROM node:18-alpine3.18 As production
COPY --chown=node:node --from=build /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=build /usr/src/app/dist ./dist

CMD ["node", "./dist/graphql/main.js"]
