---
title: "Aan de slag"
description: "Draai de CloudShirt-Hugo site en de CloudShirt-app lokaal."
weight: 10
---

De broncode van de CloudShirt-app staat op [Stensel8/CloudShirt](https://github.com/Stensel8/CloudShirt).

## Hugo-site lokaal draaien

**Vereisten:** [Hugo extended](https://gohugo.io/installation/) ≥ v0.159.2 en [Go](https://go.dev/dl/) ≥ v1.26.

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

| Variant | Aanbevolen voor |
|---|---|
| .NET lokaal | Snel debuggen zonder containers |
| Docker | Cloud-achtige containersetup valideren |
