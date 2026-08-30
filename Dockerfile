FROM directus/directus:12.2.0

USER root

COPY --chown=node:node ./extensions /directus/extensions

USER node
