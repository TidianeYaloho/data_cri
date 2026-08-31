# Mise à jour des exigences CRI

Branche : `feat/mise-a-jour-exigences-cri`  
Point de départ : `39324a2e2a653fadeef60ca00078c01d0f4a477d`

## Principes retenus

- migration additive et progressive ;
- conservation de `province`, `nombre_postes`, `pays` et `fonction` ;
- `provinces` devient la source multi-valeurs, avec fallback sur `province` ;
- les données historiques restent importables en brouillon ;
- la validation stricte intervient uniquement lors de la publication ;
- aucun rôle Agent CRI n’est créé ;
- les fichiers HTML sont toujours téléchargés en pièce jointe et jamais injectés dans React.

## Ordre exact d’application locale

Depuis `D:\ECC\STAGE\stage 2A\FORVIS MAZARS\mission7\CRI_Projets` :

```powershell
git fetch origin
git switch feat/mise-a-jour-exigences-cri
git pull origin feat/mise-a-jour-exigences-cri

New-Item -ItemType Directory -Force .\backups | Out-Null
docker compose exec database sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" > /tmp/avant_exigences_cri.sql'
docker compose cp database:/tmp/avant_exigences_cri.sql .\backups\avant_exigences_cri.sql

# Créer dans Directus un jeton statique ADMIN temporaire, puis :
$env:DIRECTUS_ADMIN_TOKEN="JETON_TEMPORAIRE"
node .\migrations\apply-exigences-cri.mjs
node .\migrations\apply-exigences-cri.mjs --apply
Remove-Item Env:DIRECTUS_ADMIN_TOKEN

docker compose up -d --build
docker compose restart directus
docker compose logs --tail=200 directus

docker compose exec frontend npm test
docker compose exec frontend npm run build
cd .\tools\import-projets-excel
npm install
npm test
cd ..\..

# Après validation fonctionnelle, régénérer le vrai snapshot de la base vivante :
docker compose exec directus node /directus/cli.js schema snapshot /directus/schema_apres_exigences_cri.yaml
docker compose cp directus:/directus/schema_apres_exigences_cri.yaml .\schema\schema_apres_exigences_cri.yaml
```

Ne jamais exécuter `docker compose down -v` : cette commande supprimerait le volume PostgreSQL.

## Import Excel

```powershell
cd .\tools\import-projets-excel
node .\import.mjs "C:\chemin\ancien-fichier.xlsx"
$env:DIRECTUS_ADMIN_TOKEN="JETON_TEMPORAIRE"
node .\import.mjs "C:\chemin\ancien-fichier.xlsx" --apply
Remove-Item Env:DIRECTUS_ADMIN_TOKEN
```

Le premier appel est un dry-run. Les doublons sur `code_projet` sont sautés et aucun projet existant n’est remplacé silencieusement.

## Vérifications fonctionnelles

1. Importer une fixture fictive avec une et deux provinces.
2. Vérifier qu’un brouillon incomplet est conservé.
3. Vérifier que sa publication est refusée avec la liste des champs manquants.
4. Compléter les six champs métier puis publier.
5. Tester les quatre filtres Province.
6. Créer et modifier un profil investisseur avec Secteur et Province.
7. Tester les modes Business Plan `desactive`, `direct` et `validation` avec un PDF puis un HTML fictif.
8. Vérifier que le HTML est téléchargé et ne s’ouvre pas dans le contexte de la plateforme.

## Retour arrière

En cas de problème, revenir à `main` et redémarrer les conteneurs. Les nouveaux champs restent volontairement en base pour éviter toute perte. La sauvegarde PostgreSQL n’est à restaurer qu’après diagnostic explicite ; aucun script automatique destructif n’est fourni.
