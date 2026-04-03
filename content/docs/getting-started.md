---
title: "Getting started"
description: "Run the CloudShirt-Hugo companion site and the CloudShirt app."
weight: 10
---

The CloudShirt application source is available at [Stensel8/CloudShirt](https://github.com/Stensel8/CloudShirt).

## Run this Hugo site locally

**Requirements:** [Hugo extended](https://gohugo.io/installation/) ≥ v0.159.2 and [Go](https://go.dev/dl/) ≥ v1.24.

```bash
# Development server
hugo server

# Production build
hugo --gc --minify
```

## Run the CloudShirt application

```bash
git clone https://github.com/Stensel8/CloudShirt.git
cd CloudShirt
```

### Local .NET mode (SQLite)

```powershell
.\scripts\run-dotnet.ps1

# Tests
dotnet test .\*.sln
```

### Docker mode (PostgreSQL)

```powershell
.\scripts\run-docker.ps1
```

| Mode | Recommended for |
|---|---|
| Local .NET | Fast debugging without containers |
| Docker | Validating cloud-like container setup |
