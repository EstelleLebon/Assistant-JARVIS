#!/bin/bash
set -e

REPO_URL="https://developer.download.nvidia.com/compute/cuda/repos/fedora43/x86_64"
TMPDIR=$(mktemp -d)
cd "$TMPDIR"

# 1. Télécharger la liste des RPM
curl -s "$REPO_URL/" | grep -oE "href='([^']+\.rpm)'" | sed -E "s/href='(.*)'/\1/" | sort | uniq > rpms.txt

# 2. Installer les paquets de configuration d'abord
for conf in cuda-toolkit-13-2-config-common cuda-toolkit-13-config-common cuda-toolkit-config-common; do
    rpm_url=$(grep "$conf" rpms.txt | head -n1)
    if [ -n "$rpm_url" ]; then
        sudo dnf install -y "$REPO_URL/$rpm_url" || true
    fi
done

# 3. Installer tous les autres paquets CUDA (en ignorant les erreurs de dépendances déjà satisfaites)
for rpm in $(cat rpms.txt); do
    sudo dnf install -y "$REPO_URL/$rpm" || true
done

cd /
rm -rf "$TMPDIR"

echo "Installation CUDA terminée. Pensez à ajouter /usr/local/cuda/lib64 à votre LD_LIBRARY_PATH si besoin."