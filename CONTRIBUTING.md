# Contributing to SubTranslate

Thank you for your interest in contributing to the SubTranslate project! This guide will help you set up your development environment and understand our dependency management approach.

## Getting Started

### Prerequisites

- Python 3.10 or higher
- [UV](https://github.com/astral-sh/uv) - Modern Python package installer and resolver

### Setting Up Your Development Environment

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/subtranslate.git
   cd subtranslate
   ```

2. Install dependencies with UV:
   - On Windows:
     ```bash
     .\install.bat --dev
     ```
   - On Linux/macOS:
     ```bash
     ./install.sh --dev
     ```

   This will:
   - Install UV if not already installed
   - Create a virtual environment in `.venv`
   - Install all development dependencies
   - Create activation scripts in the `scripts` directory

3. Activate the virtual environment:
   - On Windows:
     ```bash
     .\scripts\activate.bat
     ```
   - On Linux/macOS:
     ```bash
     source ./scripts/activate.sh
     ```

## Dependency Management

We use UV for all dependency management in this project.

### Core Principles

1. The source of truth for dependencies is `pyproject.toml`
2. Never use pip directly, always use UV
3. Pin dependencies for reproducible builds
4. Use UV's virtual environments for isolation

### Adding New Dependencies

1. Add the dependency to `pyproject.toml` in the appropriate section
2. Run the requirements generator to update requirements files:
   ```bash
   python generate_requirements.py
   ```
   
   Or on Windows:
   ```bash
   generate_requirements.bat
   ```

3. Commit both the updated `pyproject.toml` and the generated requirements files

### Updating Dependencies

1. Update the version constraints in `pyproject.toml`
2. Regenerate the requirements files as shown above
3. Test thoroughly before committing

### Installing Dependencies in CI or Production

Always use UV with our pinned requirements files:

```bash
uv pip sync requirements.txt
```

For development environments:

```bash
uv pip sync requirements-dev.txt
```

## Project Structure

- `src/` - Main package source code
- `tests/` - Test suite
- `docs/` - Documentation
- `scripts/` - Helper scripts

## Code Style

We follow PEP 8 guidelines with some modifications defined in our tooling configuration (in `pyproject.toml`). The codebase is checked with:

- Black for code formatting
- isort for import sorting
- mypy for type checking
- ruff for linting

You can run all linters with:

```bash
# Format code
black src tests
isort src tests

# Check types
mypy src tests

# Lint
ruff src tests
```

## Testing

Run tests with pytest:

```bash
pytest
```

For coverage report:

```bash
pytest --cov=src
```

## Before Submitting a Pull Request

1. Update any relevant documentation
2. Add or update appropriate tests
3. Make sure all tests pass and linting is clean
4. Regenerate requirements files if you've made dependency changes

Thank you for contributing to SubTranslate! 