---
title: "Assignment 3 – Cloud Orchestration"
description: "Deploy CloudShirt via Kubernetes of Docker Swarm."
weight: 30
---

Deploy CloudShirt schaalbaar via een orchestrator in de cloud.

> Broncode: [Stensel8/CloudShirt](https://github.com/Stensel8/CloudShirt)

## Stappen

**1. Images bouwen en pushen**

```bash
git clone https://github.com/Stensel8/CloudShirt.git && cd CloudShirt
docker build -t <registry>/cloudshirt-web:latest -f src/Web/Dockerfile .
docker build -t <registry>/cloudshirt-api:latest -f src/PublicApi/Dockerfile .
docker push <registry>/cloudshirt-web:latest
docker push <registry>/cloudshirt-api:latest
```

**2. Docker Swarm deployen**

```bash
docker swarm init
docker stack deploy -c swarm-stack.yml cloudshirt
docker stack services cloudshirt
```

**3. Kubernetes (EKS)**

```bash
eksctl create cluster --name cloudshirt --region eu-west-1 --nodes 2
kubectl get pods && kubectl get services
```

**4. Opschalen**

```bash
# Swarm
docker service scale cloudshirt_eshopwebmvc=3

# Kubernetes
kubectl scale deployment cloudshirt-web --replicas=3
```
