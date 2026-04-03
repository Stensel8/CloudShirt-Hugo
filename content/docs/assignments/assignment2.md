---
title: "Assignment 2 – Docker in the Cloud"
weight: 2
---

In deze opdracht containeriseer je CloudShirt en deploy je het via Docker Compose op een cloud-VM.

> De broncode staat in [Stensel8/CloudShirt](https://github.com/Stensel8/CloudShirt).

## Doelen

- Docker en Docker Compose begrijpen
- CloudShirt draaien in containers
- PostgreSQL koppelen als database

## Stappen

{{< steps >}}

### Stap 1: Docker installeren

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
```

### Stap 2: Repository clonen

```bash
git clone https://github.com/Stensel8/CloudShirt.git
cd CloudShirt
```

### Stap 3: Omgevingsvariabelen instellen

Kopieer `.env.example` naar `.env` en pas de variabelen aan:

```bash
cp .env.example .env
```

### Stap 4: Docker Compose starten

```bash
.\scripts\run-docker.ps1
# of direct:
docker compose up -d
```

### Stap 5: Testen

- Webapp: [http://localhost:5106](http://localhost:5106)
- API: [http://localhost:5200/swagger](http://localhost:5200/swagger)

{{< /steps >}}

## CloudShirt Docker-architectuur

| Service | Container | Poort |
|---|---|---|
| Web frontend | `cloudshirt-web-frontend` | `5106:80` |
| API backend | `cloudshirt-api-backend` | `5200:80` |
| PostgreSQL | `cloudshirt-db-postgres` | `5432:5432` |
