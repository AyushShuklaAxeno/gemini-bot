FROM node:20-slim

# Install git for diff operations
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Avoid "fatal: detected dubious ownership in repository" when running on mounted consumer repositories
RUN git config --system --add safe.directory '*'

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY . .

# Entry point script (absolute path required as GitHub Actions sets working directory to consumer repo)
ENTRYPOINT ["node", "/app/scripts/ci/review.mjs"]