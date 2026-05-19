# Repo Notes

## Container Workflow

This project includes a minimal Docker workflow:

```bash
docker compose up --build
```

The app listens on `http://localhost:3000`. The SQLite database is stored under `data/` in the mounted workspace.

For local non-container development:

```bash
npm install
npm run migrate
npm run create-user -- --admin
npm run dev
```
