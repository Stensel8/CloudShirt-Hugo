---
title: Aan de slag
weight: 1
---

> **Let op:** deze pagina beschrijft hoe je de **Hugo-site** lokaal ontwikkelt én hoe je de originele **CloudShirt-applicatie** draait. De broncode van de applicatie staat in de [Stensel8/CloudShirt](https://github.com/Stensel8/CloudShirt)-repository.

---

## Hugo-site lokaal draaien

### Vereisten

- [Hugo extended](https://gohugo.io/installation/) ≥ v0.159.2
- [Go](https://go.dev/dl/) ≥ v1.24

### Development server starten

```bash
hugo server
```

De site is beschikbaar op [http://localhost:1313](http://localhost:1313).

### Productie-build maken

```bash
hugo --gc --minify
```

De statische output wordt geplaatst in `public/`.

---

## CloudShirt-applicatie draaien

De CloudShirt-applicatie staat in de [Stensel8/CloudShirt](https://github.com/Stensel8/CloudShirt)-repository. Clone die repository eerst:

```bash
git clone https://github.com/Stensel8/CloudShirt.git
cd CloudShirt
```

### Lokale .NET app (.NET 10)

Monolithische variant. Draait lokaal in één app met SQLite.

```powershell
.\scripts\run-dotnet.ps1
```

Tests uitvoeren:

```powershell
dotnet test .\*.sln
```

### Docker app (containers)

Containervariant met Docker Compose en PostgreSQL.

```powershell
.\scripts\run-docker.ps1
```

---

## Wanneer gebruik je welke variant?

| Variant | Wanneer gebruiken |
|---|---|
| Lokale .NET variant | Snel opstarten en debuggen, geen Docker nodig, data in SQLite |
| Docker variant | Test de containersetup zoals die ook in de cloud draait, data in PostgreSQL |

---

## Data en state

- SQLite (lokale .NET) en PostgreSQL (Docker) delen **niet** automatisch dezelfde data/state.
- Bij wisselen van modus start je dus met de state van de bijbehorende database.
