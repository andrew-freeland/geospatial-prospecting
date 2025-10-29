# IAM and Secrets

- Use one service account per environment (dev/staging/prod).
- Grant least-privilege scopes to each Vertex AI Extension (Places, Directions, Sheets, Drive, Slack, Gmail).
- Store any API tokens/credentials in Secret Manager; do not commit secrets.
- Rotate keys regularly and monitor quota usage for Maps Platform.
