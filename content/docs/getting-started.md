---
title: "Aan de slag"
description: "Hoe je de Hugo-site lokaal ontwikkelt en de CloudShirt-app draait."
weight: 10
---

> De broncode van de CloudShirt-applicatie staat in [Stensel8/CloudShirt](https://github.com/Stensel8/CloudShirt).

## Hugo-site lokaal draaien

**Vereisten:** [Hugo extended](https://gohugo.io/installation/) ≥ v0.159.2 en [Go](https://go.dev/dl/) ≥ v1.24.

```bash
# Development server
hugo server

# Productie-build
hugo --gc --minify
```

## CloudShirt-applicatie draaien

```bash
git clone https://github.com/Stensel8/CloudShirt.git
cd CloudShirt
```

### Lokale .NET-variant (SQLite)

```powershell
.\scripts\run-dotnet.ps1

# Tests
dotnet test .\*.sln
```

### Docker-variant (PostgreSQL)

```powershell
.\scripts\run-docker.ps1
```

| Variant | Wanneer |
|---|---|
| .NET lokaal | Snel debuggen, geen Docker nodig |
| Docker | Test containersetup zoals in de cloud |
