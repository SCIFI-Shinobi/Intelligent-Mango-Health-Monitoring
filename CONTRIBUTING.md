# Contributing

Thanks for helping improve MangoGuard.

## 1. Setup
1. Fork the repository
2. Create a feature branch
3. Set up local environment using [README.md](./README.md)

## 2. Development guidelines
- Keep PRs focused and small.
- Follow existing project structure and naming.
- Do not commit secrets or real API keys.
- Update documentation when behavior/setup changes.

## 3. Validation before PR
From `frontend/`:

```bash
npm ci
CI=true npm test -- --watchAll=false
npm run build
```

For full stack checks:

```bash
docker compose config
docker compose up --build
```

## 4. Pull request checklist
- [ ] Issue linked or problem statement provided
- [ ] Changes are scoped and reviewed
- [ ] Docs updated (if applicable)
- [ ] No secrets in code or logs
- [ ] Build/test commands run locally
