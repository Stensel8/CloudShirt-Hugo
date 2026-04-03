# CloudShirt – Hugo Edition

Een lichte Hugo-variant van CloudShirt met winkelervaring.

Dit is de Hugo-variant van [CloudShirt](https://github.com/Stensel8/CloudShirt), gebouwd met [Hugo](https://gohugo.io/) en het [Blowfish](https://blowfish.page/)-thema, gedeployed via Docker (nginx).

De focus ligt op functionele parity met CloudShirt: producten bekijken, winkelwagen gebruiken en bestelstroom volgen.

## Architectuur (3 services)

- `web`: Hugo + nginx (UI, content, storefront)
- `api`: Go API (basket, orders, catalog endpoint, health)
- `db`: PostgreSQL (persistente basket + orders)

De storefront gebruikt API-only gedrag voor catalogus, basket, login en orders.

De storefront draait nu in **strict API mode**: als de API niet bereikbaar is, wordt de storefront geblokkeerd met een duidelijke foutmelding.

---

## Lokale ontwikkeling

**Vereisten:** Hugo extended ≥ v0.159.2 en Go ≥ v1.24.

```bash
hugo server        # development server
hugo --gc --minify # productie-build
```

## Docker

```bash
docker compose up -d --build   # start op http://localhost:8080
docker compose down    # stoppen
```

Belangrijke endpoints:

- `http://localhost:8080/` web storefront
- `http://localhost:8080/api/health` API via nginx proxy
- `http://localhost:8081/api/health` API direct

Let op:

- `http://localhost:8081/` toont API-metadata (geen webshop-UI)
- `http://localhost:5432/` is PostgreSQL en geen browser-URL

## Demo login

- Email: `demouser@microsoft.com`
- Wachtwoord: `Pass@word1`

## Admin login

- Email: `admin@microsoft.com`
- Wachtwoord: `Pass@word1`

Te overschrijven via env vars op de API service:

- `DEMO_USER_EMAIL`
- `DEMO_USER_PASSWORD`
- `DEMO_USER_NAME`
- `ADMIN_USER_EMAIL`
- `ADMIN_USER_PASSWORD`
- `ADMIN_USER_NAME`

## Technische stack

| Onderdeel | Versie |
|---|---|
| Hugo (extended) | v0.159.2 |
| Blowfish theme | v2.101.0 |
| nginx | 1.29.7-alpine-slim |
| Go API | go1.24 |
| PostgreSQL | 16-alpine |
