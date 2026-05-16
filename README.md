# automations

Node.js browser automation monorepo. Each automation lives in its own folder with independent dependencies.

## Automations

| Name | Description | Status |
|------|-------------|--------|
| [projudi-monitor](projudi-monitor/) | Monitors Brazilian court cases on Projudi TJBA and prints new movimentações to the terminal | v1.0 |

## Structure

```
automations/
  projudi-monitor/    # Playwright CLI for Projudi TJBA monitoring
    index.js
    config/
    state/            # gitignored — created on first run
    README.md
```

Each automation is self-contained — see its own `README.md` for installation and usage.
