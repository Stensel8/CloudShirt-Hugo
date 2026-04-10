# CloudShirt-Hugo (Go + Hugo)

> [!WARNING]
> **Deprecated vanaf juni 2026.** Deze applicatie is puur gebouwd als schooldemo en wordt niet verder doorontwikkeld. De repository wordt niet meer onderhouden.

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

## Gerelateerde repositories

Dit project maakt deel uit van een driehoek van samenhangende repo's:

| Repository | Rol |
|------------|-----|
| [Stensel8/CloudShirt](https://github.com/Stensel8/CloudShirt) | .NET-variant van dezelfde use-case; monoliet én microservices; basis voor Assignment 1 |
| **[Stensel8/CloudShirt-Hugo](https://github.com/Stensel8/CloudShirt-Hugo)** *(deze repo)* | Go/Hugo-applicatie - alleen Docker/microservices; gebruikt in Assignment 2 (Docker Swarm) |
| [stensel8/cloud-engineering](https://github.com/stensel8/cloud-engineering/tree/main/cloud-automation-concepts) | Schoolopdracht IaC (AWS/Terraform/Ansible) waarvoor beide apps zijn gebouwd |

## Credits

Dit project is gemaakt door **[Stensel8](https://github.com/Stensel8)** en **[Hintenhaus04](https://github.com/Hintenhaus04)** als schoolopdracht (Cloud Engineering, jaar 3). De opdracht vroeg om een IaC-infrastructuur op AWS op te zetten met eigen gedockerized applicaties - dat werd de aanleiding om zelf twee apps te bouwen.

### Upstreams & inspiratie

Deze Go/Hugo-variant is geïnspireerd op de .NET eShop-familie en gebouwd als zelfstandige implementatie van dezelfde use-case:

| Bron | Beschrijving |
|------|-------------|
| [looking4ward/CloudShirt](https://github.com/looking4ward/CloudShirt) | Upstream van de docent, als startpunt voor deze opdracht |
| [NimblePros/eShopOnWeb](https://github.com/NimblePros/eShopOnWeb) | Onderhouden fork van eShopOnWeb door een .NET-community maintainer |
| [dotnet-architecture/eShopOnWeb](https://github.com/dotnet-architecture/eShopOnWeb) | Originele Microsoft demo-applicatie (deprecated / end-of-life) |

### Tooling

- Ontwikkeld met hulp van **[Claude Code](https://claude.ai/code)** (Anthropic) als AI-assistent bij de implementatie.
