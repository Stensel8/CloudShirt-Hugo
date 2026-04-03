# CloudShirt – Hugo Edition

Een lichte Hugo-variant van CloudShirt met winkelervaring.

Dit is de Hugo-variant van [CloudShirt](https://github.com/Stensel8/CloudShirt), gebouwd met [Hugo](https://gohugo.io/) en het [Blowfish](https://blowfish.page/)-thema, gedeployed via Docker (nginx).

De focus ligt op functionele parity met CloudShirt: producten bekijken, winkelwagen gebruiken, inloggen/uitloggen en bestelstroom volgen.

---

## Lokale ontwikkeling

**Vereisten:** Hugo extended ≥ v0.159.2 en Go ≥ v1.26.

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
