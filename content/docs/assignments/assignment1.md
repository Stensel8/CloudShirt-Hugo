---
title: "Assignment 1 – AWS Basics"
description: "Deploy CloudShirt op AWS EC2."
weight: 10
---

Maak kennis met AWS-basisconcepten en deploy CloudShirt op een EC2-instantie.

## Stappen

**1. EC2-instantie starten**

Start een `t2.micro` met Ubuntu 22.04 en open poorten `80` en `5106` in de security group.

**2. .NET installeren**

```bash
sudo apt-get update && sudo apt-get install -y dotnet-sdk-10.0
```

**3. CloudShirt clonen en starten**

```bash
git clone https://github.com/Stensel8/CloudShirt.git
cd CloudShirt
.\scripts\run-dotnet.ps1
```

**4. Testen**

Open de browser en navigeer naar het publieke IP van de EC2-instantie.
