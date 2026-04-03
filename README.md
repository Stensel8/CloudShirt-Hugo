# CloudShirt – Hugo Edition

Een lichte Hugo-website voor schoolopdrachten binnen de Cloud Engineering-specialisatie.

Dit is de Hugo-variant van [CloudShirt](https://github.com/Stensel8/CloudShirt) – dezelfde inhoud, maar gegenereerd als statische site met [Hugo](https://gohugo.io/) en het [Hextra](https://imfing.github.io/hextra)-thema. Gebouwd om te deployen via Docker (nginx).

Gekoppelde module-repository:
- https://github.com/Stensel8/cloud-engineering/tree/main/cloud-automation-concepts

## Gebruik in opdrachten

- Assignment 1: AWS Basics
- Assignment 2: Docker in the Cloud
- Assignment 3: Cloud Orchestration

---

## Lokale ontwikkeling

### Vereisten

- [Hugo extended](https://gohugo.io/installation/) ≥ v0.159.2
- [Go](https://go.dev/dl/) ≥ v1.24

### Starten

```bash
hugo server
```

De site is beschikbaar op http://localhost:1313.

### Bouwen

```bash
hugo --gc --minify
```

De statische output wordt geplaatst in `public/`.

---

## Docker

### Met Docker Compose

```bash
docker compose up -d
```

De site is beschikbaar op http://localhost:8080.

### Stoppen

```bash
docker compose down
```

### Direct bouwen en starten

```bash
docker build -t cloudshirt-hugo .
docker run -p 8080:80 cloudshirt-hugo
```

---

## Technische stack

| Onderdeel | Versie |
|---|---|
| Hugo (extended) | v0.159.2 |
| Hextra theme | v0.12.1 |
| nginx | alpine (latest) |

---

## Credits

- Originele CloudShirt: https://github.com/Stensel8/CloudShirt
- Originele upstream: https://github.com/dotnet-architecture/eShopOnWeb
- Hugo: https://gohugo.io/
- Hextra: https://imfing.github.io/hextra
