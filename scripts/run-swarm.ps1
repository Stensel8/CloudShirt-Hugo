<#
.SYNOPSIS
    Start CloudShirt-Hugo in Docker Swarm mode.

.DESCRIPTION
    Bouwt images en deployed de CloudShirt-Hugo stack naar Docker Swarm.

.EXAMPLE
    .\scripts\run-swarm.ps1
#>

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Section {
    param([string]$Title)
    Write-Output ""
    Write-Output "===== $Title ====="
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot

try {
    Write-Section "Vooraf controleren"

    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Output "FOUT: Docker CLI niet gevonden."
        exit 1
    }

    $swarmState = docker info --format "{{.Swarm.LocalNodeState}}"
    if ($swarmState -eq "inactive") {
        Write-Section "Swarm initialiseren"
        docker swarm init | Out-Null
        Write-Output "Docker Swarm geinitialiseerd."
    }

    Write-Section "Images bouwen"
    docker compose build web api

    Write-Section "Stack deployen"
    docker stack deploy -c .\docker-compose.swarm.yml cloudshirt-hugo

    Write-Section "Services"
    docker stack services cloudshirt-hugo

    Write-Section "Klaar"
    Write-Output "CloudShirt-Hugo draait in Swarm-modus."
    Write-Output "- Web: http://localhost:5106"
    Write-Output "- API health: http://localhost:5200/api/health"
}
finally {
    Pop-Location
}
