# CloudShirt – Hugo Edition

A lightweight Hugo companion for the CloudShirt webshop.

This is the Hugo variant of [CloudShirt](https://github.com/Stensel8/CloudShirt), built with [Hugo](https://gohugo.io/) and the [Blowfish](https://blowfish.page/) theme, and deployed via Docker (nginx).

It focuses on CloudShirt product catalog and ordering flow parity in a lighter, modern presentation.

---

## Lokale ontwikkeling

**Vereisten:** Hugo extended ≥ v0.159.2 en Go ≥ v1.24.

```bash
hugo server        # development server
hugo --gc --minify # productie-build
```

## Docker

```bash
docker compose up -d   # start op http://localhost:8080
docker compose down    # stoppen
```

## Technische stack

| Onderdeel | Versie |
|---|---|
| Hugo (extended) | v0.159.2 |
| Blowfish theme | v2.101.0 |
| nginx | 1.29.7-alpine-slim |
