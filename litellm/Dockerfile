# Hosted LiteLLM proxy (Northflank) — same config as local docker compose,
# baked into the image since there's no volume mount for config files.
# Build context: /litellm. See docs/05-deployment.md.
FROM ghcr.io/berriai/litellm:main-stable
COPY config.yaml /app/config.yaml
CMD ["--config", "/app/config.yaml", "--port", "4000"]
