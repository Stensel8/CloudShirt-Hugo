# CloudShirt-Hugo (Go + Hugo)

Demo-project voor school als microservices-variant:

- Web: Hugo + nginx
- API: Go
- Database: PostgreSQL

Dit project draait alleen als Docker/microservices (geen monolietmodus).

## Starten

```powershell
.\scripts\run-docker.ps1
```

Swarm:

```powershell
.\scripts\run-swarm.ps1
```

## Stoppen

```powershell
.\scripts\stop-docker.ps1
.\scripts\stop-swarm.ps1
```

## Demo-poorten

- Web: http://localhost:5106
- API direct: http://localhost:5200/api/health
- API via web proxy: http://localhost:5106/api/health
- PostgreSQL: localhost:5432

## Demo users

- User: demouser@microsoft.com / Pass@word1
- Admin: admin@microsoft.com / Pass@word1

## Doel

Dit project laat zien dat dezelfde CloudShirt-use-case ook werkt als:

- Go/Hugo microservices
