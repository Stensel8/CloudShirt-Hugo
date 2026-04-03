---
title: "Assignment 3 – Cloud Orchestration"
weight: 3
---

In deze opdracht deploy je CloudShirt via een orchestrator (bijv. Kubernetes of Docker Swarm) in de cloud.

> De broncode staat in [Stensel8/CloudShirt](https://github.com/Stensel8/CloudShirt).

## Doelen

- Kubernetes of Docker Swarm begrijpen
- CloudShirt schaalbaar deployen
- Health checks en rolling updates toepassen

## Stappen

{{< steps >}}

### Stap 1: Repository clonen en images bouwen

Clone de CloudShirt-repository en bouw de Docker images:

```bash
git clone https://github.com/Stensel8/CloudShirt.git
cd CloudShirt
docker build -t <registry>/cloudshirt-web:latest -f src/Web/Dockerfile .
docker build -t <registry>/cloudshirt-api:latest -f src/PublicApi/Dockerfile .
docker push <registry>/cloudshirt-web:latest
docker push <registry>/cloudshirt-api:latest
```

### Stap 2: Cluster opzetten

Kies een orchestrator en maak een cluster aan:

{{< tabs >}}
  {{< tab name="Kubernetes (EKS)" >}}
```bash
eksctl create cluster --name cloudshirt --region eu-west-1 --nodes 2
```
  {{< /tab >}}
  {{< tab name="Docker Swarm" >}}
```bash
docker swarm init
```
  {{< /tab >}}
{{< /tabs >}}

### Stap 3: Stack deployen

Voor Docker Swarm gebruik je `swarm-stack.yml` uit de CloudShirt-repository:

```bash
docker stack deploy -c swarm-stack.yml cloudshirt
```

### Stap 4: Controleren

```bash
docker stack services cloudshirt
# of voor Kubernetes:
kubectl get pods
kubectl get services
```

### Stap 5: Testen en opschalen

```bash
# Kubernetes
kubectl scale deployment cloudshirt-web --replicas=3

# Docker Swarm
docker service scale cloudshirt_eshopwebmvc=3
```

{{< /steps >}}
