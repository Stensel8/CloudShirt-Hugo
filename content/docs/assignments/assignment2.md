---
title: "Assignment 2 – Docker in the Cloud"
description: "Containeriseer CloudShirt met Docker Compose en PostgreSQL."
weight: 20
---

Containeriseer CloudShirt en deploy via Docker Compose op een cloud-VM.

> Broncode: [Stensel8/CloudShirt](https://github.com/Stensel8/CloudShirt)

## Architectuur

| Service | Container | Poort |
|---|---|---|
| Web frontend | `cloudshirt-web-frontend` | `5106:80` |
| API backend | `cloudshirt-api-backend` | `5200:80` |
| PostgreSQL | `cloudshirt-db-postgres` | `5432:5432` |

## Stappen

**1. Docker installeren**

```bash
sudo apt-get install -y docker.io docker-compose-plugin
```

**2. Repository clonen en omgevingsvariabelen instellen**

```bash
git clone https://github.com/Stensel8/CloudShirt.git && cd CloudShirt
cp .env.example .env
```

**3. Starten**

```powershell
.\scripts\run-docker.ps1
```

**4. Testen**

- Webapp: http://localhost:5106
- API: http://localhost:5200/swagger
