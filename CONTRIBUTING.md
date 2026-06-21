# Contributing to FanDock

Thank you for your interest in contributing to FanDock! Here's how you can help.

## Reporting bugs

Open an issue on GitHub with:
- A clear description of the problem
- Steps to reproduce it
- Your hardware (motherboard, fan chip if known)
- FanDock version and deployment method (Docker / TrueNAS)

## Suggesting features

Open an issue before writing any code. Describe the feature and the problem it solves. This avoids duplicate work and lets us discuss the best approach first.

## Adding a language

This is the easiest way to contribute — no programming knowledge required:

1. Copy `frontend/static/js/i18n/en.json` to a new file named with the 2-letter language code (e.g. `pt.json` for Portuguese)
2. Add `"_name": "Your language name"` at the top (e.g. `"_name": "Português"`)
3. Translate all the values — do not change the keys
4. Open a Pull Request

The new language will be detected and added to the selector automatically.

## Contributing code

1. Fork the repository
2. Create a branch from `dev` (not `main`): `feat/issue-XX-short-description`
3. Make your changes
4. Commit with a clear message referencing the issue: `feat: add XYZ feature (#XX)`
5. Open a Pull Request against the `dev` branch — never against `main`
6. Add `Closes #XX` in the PR description to auto-close the issue on merge

### Branch naming
- `feat/issue-XX-description` — new features
- `fix/issue-XX-description` — bug fixes
- `chore/description` — maintenance, dependencies, docs

### Commit style
We follow a simple convention:
- `feat:` — new feature
- `fix:` — bug fix
- `chore:` — maintenance
- `docs:` — documentation only

### Code style
- Backend: Python with FastAPI, follow existing patterns
- Frontend: Vanilla JS, no frameworks, keep it simple
- All user-visible strings must go through the i18n system (`T.key` in JS, keys in JSON files)

### Branch model
```
main     → stable releases only
dev      → integration branch, always deployable
feat/XX  → feature branches, merged to dev via PR
```
Never commit directly to `main`. All changes go through `dev`.

## Questions?

Open an issue or start a discussion on GitHub.