# CloudShirt – Hugo Edition

Een lichte Hugo-website voor schoolopdrachten binnen de Cloud Engineering-specialisatie.

Dit is de Hugo-variant van [CloudShirt](https://github.com/Stensel8/CloudShirt), gebouwd met [Hugo](https://gohugo.io/) en het [Blowfish](https://blowfish.page/)-thema. Gedeployed via Docker (nginx).

Gekoppelde module-repository: [cloud-engineering](https://github.com/Stensel8/cloud-engineering/tree/main/cloud-automation-concepts)

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
