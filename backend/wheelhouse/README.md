Place pre-downloaded Python wheels here for Docker builds.

If this folder contains a `.complete` marker, Docker installs the backend fully
offline from these local wheels. Otherwise Docker will prefer local wheels here
and download any missing packages from PyPI.

Recommended command from the repository root:

```bash
./backend/download_wheels.sh
```

Manual fallback if you only want to place a few wheels here:

- Docker will still use them first because the build runs with `--find-links /tmp/wheelhouse`
- For a fully offline build, this folder must contain the whole dependency set and a `.complete` file

The most reliable approach is to download everything with Python 3.11 inside the
official Docker image so host Python version differences do not matter.
