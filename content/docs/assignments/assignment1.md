---
title: "Assignment 1 – AWS Basics"
weight: 1
---

In deze opdracht maak je kennis met de basisconcepten van AWS en deploy je CloudShirt op een AWS-omgeving.

## Doelen

- AWS-account opzetten en IAM begrijpen
- EC2-instantie aanmaken en configureren
- CloudShirt lokaal starten en bereikbaar maken vanuit de cloud

## Stappen

{{< steps >}}

### Stap 1: AWS-account en IAM

Maak een AWS-account aan (of gebruik een bestaand Learner Lab-account) en configureer een IAM-gebruiker met de benodigde rechten.

### Stap 2: EC2-instantie starten

Start een EC2-instantie (bijv. `t2.micro`) met Ubuntu 22.04 en open de juiste security group poorten (`80`, `443`, `5106`).

### Stap 3: .NET installeren

```bash
sudo apt-get update && sudo apt-get install -y dotnet-sdk-10.0
```

### Stap 4: CloudShirt clonen en starten

```bash
git clone https://github.com/Stensel8/CloudShirt.git
cd CloudShirt
./scripts/run-dotnet.ps1
```

### Stap 5: Testen

Open de browser en navigeer naar het publieke IP-adres van je EC2-instantie.

{{< /steps >}}
