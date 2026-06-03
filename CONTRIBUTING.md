# 🤝 Contributing to MangoGuard

Thank you for your interest in contributing! MangoGuard is an open-source project built to help Ethiopian smallholder farmers detect and manage mango diseases using Edge AI and IoT technology. Contributions of all kinds are welcome.

---

## Ways to Contribute

- 🐛 **Report bugs** — Open a GitHub Issue with steps to reproduce
- 💡 **Suggest features** — Open a Discussion or Issue with your idea
- 📝 **Improve documentation** — Fix typos, clarify setup steps, add examples
- 🌍 **Translations** — Improve Amharic translations or add new language support
- 🤖 **Model improvements** — Better training data, fine-tuning, new disease classes
- 🧪 **Write tests** — Backend API tests, frontend component tests

---

## Development Setup

### 1. Fork and clone

```bash
git clone https://github.com/YOUR-USERNAME/Intelligent-Mango-Health-Monitoring.git
cd Intelligent-Mango-Health-Monitoring
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edit both .env files with your local/dev credentials
```

### 3. Start the backend

```bash
# Option A: Docker (easiest — spins up PostgreSQL automatically)
docker-compose up -d

# Option B: Local Python with SQLite (no Docker needed)
cd backend
pip install -r requirements.txt
DATABASE_URL=sqlite:///./plant_health.db uvicorn app.main:app --reload
```

### 4. Start the frontend

```bash
cd frontend
npm install
npm start
```

### 5. (Optional) Seed demo data

```bash
cd backend
python seed.py
```

---

## Branch Naming

| Type | Pattern | Example |
| :--- | :--- | :--- |
| Bug fix | `fix/short-description` | `fix/websocket-reconnect` |
| New feature | `feat/short-description` | `feat/amharic-pdf-report` |
| Documentation | `docs-short-description` | `docs-deployment-guide` |
| Chore / tooling | `chore/short-description` | `chore/update-deps` |

---

## Pull Request Expectations

1. **Open an issue first** for anything larger than a small bug fix — let's discuss before you invest time building.
2. **Keep PRs focused** — one logical change per PR.
3. **Test your changes** — verify the backend starts, API endpoints respond, and the dashboard renders without errors.
4. **Update documentation** — if your change adds or modifies behaviour, update the relevant README section, ARCHITECTURE.md, or DEPLOYMENT.md.
5. **Describe your PR** — explain *what* changed and *why*. Screenshots are very welcome for UI changes.

---

## Code Style

### Backend (Python)
- Follow [PEP 8](https://peps.python.org/pep-0008/)
- Type hints on all new functions
- Docstrings on public functions

### Frontend (JavaScript/React)
- Functional components with hooks — no class components
- Keep components small and single-purpose
- New bilingual strings must have both `en` and `am` entries

---

## Reporting Security Issues

Please **do not** open a public issue for security vulnerabilities. Email the maintainer directly or use GitHub's private security advisory feature.

---

## License

By contributing, you agree that your contributions will be licensed under the [GNU General Public License v3.0](./LICENSE).

