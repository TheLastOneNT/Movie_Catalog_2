# Security policy

This is a private household application. Do not report private access keys or credentials in a public GitHub issue.

## Secrets

- Store the production household key as the Cloudflare Worker secret `ACCESS_KEY`.
- Store local-only values in `.dev.vars`.
- Never commit Cloudflare API tokens, database credentials, or exported backups.
- Rotate any credential that has ever been committed to a public repository.

