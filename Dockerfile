FROM node:8.2.1

MAINTAINER Adam Hooper <adam@adamhooper.com>

RUN groupadd -r app && useradd -r -g app app

# use changes to package-lock.json to force Docker not to use the cache
# when we change our application's nodejs dependencies:
COPY package.json /tmp/package.json
COPY package-lock.json /tmp/package-lock.json
RUN cd /tmp && npm install --production
RUN mkdir -p /opt/app && mv /tmp/node_modules /opt/app/

# From here we load our application's code in, therefore the previous docker
# "layer" thats been cached will be used if possible
COPY package.json package-lock.json README.md server.js /opt/app/
COPY views/ /opt/app/views/
COPY public /opt/app/public/

USER app
WORKDIR /opt/app

ENV PORT 3000
EXPOSE 3000
CMD [ "node", "server.js" ]
