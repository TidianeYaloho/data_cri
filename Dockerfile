FROM node:22-alpine AS extension-deps

WORKDIR /tmp/exigences-projets
COPY ./extensions/directus-extension-exigences-projets/package.json ./extensions/directus-extension-exigences-projets/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

WORKDIR /tmp/workflow-business-plan
COPY ./extensions/directus-extension-workflow-business-plan/package.json ./extensions/directus-extension-workflow-business-plan/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts


FROM directus/directus:12.2.0

USER root

COPY --chown=node:node ./extensions /directus/extensions

COPY --from=extension-deps --chown=node:node /tmp/exigences-projets/node_modules /directus/extensions/directus-extension-exigences-projets/node_modules
COPY --from=extension-deps --chown=node:node /tmp/workflow-business-plan/node_modules /directus/extensions/directus-extension-workflow-business-plan/node_modules

USER node
