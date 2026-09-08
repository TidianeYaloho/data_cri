# Reprise guidée — mise à jour des exigences CRI

Ce document est le point de reprise unique pour continuer la mise à jour dans un autre clavardage. Il décrit l'état réel du projet, les décisions prises, les commandes PowerShell à exécuter dans l'ordre, les résultats attendus et les arrêts de sécurité.

## 1. Consigne pour le prochain assistant

Accompagner Tidiane étape par étape à partir de la première étape non terminée :

- donner un seul bloc logique de commandes à la fois ;
- attendre et analyser toute la sortie avant de poursuivre ;
- ne jamais demander à voir ou à recevoir le jeton Directus ;
- ne jamais lancer `--apply` tant que le dry-run n'est pas validé ;
- ne jamais exécuter `docker compose down -v` ;
- ne pas modifier, ajouter ou supprimer le dossier local non suivi `supabase_migration/` ;
- ne restaurer la sauvegarde PostgreSQL qu'après un diagnostic explicite.

## 2. Environnement et branche

- Dossier Windows : `D:\ECC\STAGE\stage 2A\FORVIS MAZARS\mission7\CRI_Projets`
- Dépôt : `https://github.com/TidianeYaloho/data_cri.git`
- Branche de travail : `feat/mise-a-jour-exigences-cri`
- Branche `main` : volontairement inchangée
- Directus : `12.2.0`, accessible sur `http://localhost:8055`
- PostgreSQL : `16-alpine`
- Frontend : `http://localhost:5173`
- Mailpit : `http://localhost:8025`
- Commit minimal requis avant migration : `7f1abd5 fix: robust Directus field detection in migration`

## 3. État exact atteint

Les quatre commits fonctionnels ont été importés et poussés :

```text
e9d92c9 schema: add project and investor requirements
aabc5bd feat: support multi-province projects in catalogue
54aa7a0 feat: update investor fields and business plan formats
cf63891 feat: add safe Excel import workflow and migration guide
```

La correction du dry-run existe sur GitHub :

```text
7f1abd5 fix: robust Directus field detection in migration
```

Une sauvegarde PostgreSQL a déjà été créée :

```text
backups\avant_exigences_cri.sql
taille vérifiée : 231093 octets
date observée : 2026-08-31 13:19:02
```

Le compte utilisé a été vérifié en base et par l'API :

- utilisateur actif ;
- rôle `Administrator` ;
- politique `Administrator` ;
- `admin_access = true` ;
- `app_access = true` ;
- appel `/users/me` : `HTTP 200`.

Un ancien jeton a été affiché par erreur dans un clavardage, puis remplacé dans Directus. Il ne doit plus être utilisé. Le nouveau jeton a été saisi de façon masquée. Une variable d'environnement PowerShell disparaît si la fenêtre PowerShell est fermée.

### Diagnostic du `403`

Le premier script appelait directement :

```text
GET /fields/PROJETS/type_projet
```

Comme `type_projet` n'existe pas encore, Directus 12.2.0 renvoie `403 FORBIDDEN` au lieu du `404` que le script attendait. Le token n'était donc pas la cause. Le commit `7f1abd5` corrige cela en listant d'abord les champs avec `GET /fields/PROJETS`, puis en déterminant localement si le champ existe.

**Aucune migration n'a encore été appliquée.** Les échecs précédents ont eu lieu pendant un dry-run et avant toute écriture.

## 4. Modifications préparées

La branche ajoute notamment :

- `PROJETS.type_projet` avec les valeurs `grand_projet`, `tpme` et `porteur_projet` ;
- `PROJETS.provinces`, champ multi-valeurs pour Guelmim, Assa-Zag, Sidi Ifni et Tan-Tan ;
- compatibilité temporaire avec l'ancien champ `PROJETS.province` ;
- `investisseurs.secteur` et `investisseurs.province` ;
- `investisseurs.pays` rendu facultatif ;
- retrait de `pays` et `fonction` des nouveaux formulaires sans suppression en base ;
- Business Plans PDF et HTML, toujours servis en téléchargement ;
- contrôle des six champs métier uniquement lors du passage explicite à `publie` ;
- filtre Province compatible avec l'ancien et le nouveau format ;
- outil d'import Excel avec mapping, dry-run, normalisation, doublons et rapport.

Les six champs exigés à la publication sont :

```text
titre
type_projet
secteur
provinces (ou ancien champ province pendant la transition)
investissement_mad
nombre_postes
```

## 5. Reprise : commandes exactes à exécuter

Toutes les commandes suivantes sont prévues pour **PowerShell**.

### Étape 1 — Se placer dans le projet et récupérer la correction

```powershell
Set-Location "D:\ECC\STAGE\stage 2A\FORVIS MAZARS\mission7\CRI_Projets"

git switch feat/mise-a-jour-exigences-cri
git pull --ff-only origin feat/mise-a-jour-exigences-cri
git log --oneline -8
git status
```

Le journal doit contenir au minimum le commit `7f1abd5`. Le dossier `supabase_migration/` peut rester affiché comme non suivi : ne pas y toucher.

**Arrêt de sécurité :** si `git pull` signale un conflit ou si le commit `7f1abd5` n'apparaît pas dans l'historique, ne pas continuer.

### Étape 2 — Vérifier les conteneurs

```powershell
docker compose ps
```

Si `database`, `directus` ou `mailpit` n'est pas démarré :

```powershell
docker compose up -d database mailpit directus
docker compose ps
```

Directus doit être `Up` et PostgreSQL doit être sain avant de continuer.

### Étape 3 — Vérifier la sauvegarde existante

```powershell
Get-Item .\backups\avant_exigences_cri.sql | Select-Object FullName, Length, LastWriteTime
```

La taille doit être strictement supérieure à zéro. Si le fichier est absent, le recréer avant toute migration :

```powershell
New-Item -ItemType Directory -Force .\backups | Out-Null

docker compose exec database sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" > /tmp/avant_exigences_cri.sql'

docker compose cp database:/tmp/avant_exigences_cri.sql .\backups\avant_exigences_cri.sql

Get-Item .\backups\avant_exigences_cri.sql | Select-Object FullName, Length, LastWriteTime
```

### Étape 4 — Charger le jeton sans l'afficher

Vérifier uniquement si la variable existe, sans imprimer sa valeur :

```powershell
if ([string]::IsNullOrWhiteSpace($env:DIRECTUS_ADMIN_TOKEN)) { "JETON ABSENT" } else { "JETON PRÉSENT" }
```

Si le résultat est `JETON ABSENT`, copier le jeton statique actuel depuis le profil administrateur Directus, puis le saisir ainsi :

```powershell
$secureToken = Read-Host "Colle le jeton administrateur Directus" -AsSecureString
$env:DIRECTUS_ADMIN_TOKEN = [System.Net.NetworkCredential]::new("", $secureToken).Password
Remove-Variable secureToken
```

Ne jamais utiliser `Read-Host` sans `-AsSecureString` et ne jamais coller le jeton dans le clavardage.

Vérifier l'identité associée au jeton :

```powershell
docker compose exec `
  -e "DIRECTUS_ADMIN_TOKEN=$env:DIRECTUS_ADMIN_TOKEN" `
  directus node -e "fetch('http://127.0.0.1:8055/users/me?fields=id,first_name,last_name,status,role.id,role.name',{headers:{Authorization:'Bearer '+process.env.DIRECTUS_ADMIN_TOKEN}}).then(async r=>{console.log('HTTP',r.status);console.log(JSON.stringify(await r.json(),null,2))})"
```

Résultat attendu : `HTTP 200`, utilisateur actif et rôle `Administrator`.

### Étape 5 — Copier le script corrigé dans Directus

Le dossier `migrations` n'est pas monté dans le conteneur ; il faut donc recopier le fichier après le `git pull` :

```powershell
docker compose cp .\migrations\apply-exigences-cri.mjs directus:/directus/apply-exigences-cri.mjs
```

### Étape 6 — Exécuter uniquement le dry-run

```powershell
docker compose exec `
  -e "DIRECTUS_URL=http://127.0.0.1:8055" `
  -e "DIRECTUS_ADMIN_TOKEN=$env:DIRECTUS_ADMIN_TOKEN" `
  directus node /directus/apply-exigences-cri.mjs
```

Pour une base encore non migrée, la sortie doit ressembler à :

```text
À créer : PROJETS.type_projet
À créer : PROJETS.provinces
À créer : investisseurs.secteur
À créer : investisseurs.province
À mettre à jour : investisseurs.pays
À mettre à jour : PROJETS.business_plan
Dry-run terminé. Relancer avec --apply pour appliquer.
```

Le nombre de projets annoncé pendant ce premier dry-run peut être `0` lorsque `provinces` n'existe pas encore ; les anciennes provinces seront parcourues pendant l'application réelle.

**Arrêt obligatoire :** faire analyser toute cette sortie par l'assistant. Ne pas ajouter spontanément `--apply` si une erreur, un `401`, un `403` ou un nom de collection inattendu apparaît.

### Étape 7 — Appliquer la migration après validation du dry-run

Seulement après validation explicite de l'étape 6 :

```powershell
docker compose exec `
  -e "DIRECTUS_URL=http://127.0.0.1:8055" `
  -e "DIRECTUS_ADMIN_TOKEN=$env:DIRECTUS_ADMIN_TOKEN" `
  directus node /directus/apply-exigences-cri.mjs --apply
```

La sortie attendue doit annoncer la création ou la mise à jour des six champs, puis :

```text
Migration additive terminée. Aucun champ historique n'a été supprimé.
```

### Étape 8 — Redémarrer Directus et vérifier les champs

```powershell
docker compose restart directus
Start-Sleep -Seconds 10
docker compose ps directus
```

Puis vérifier les champs via l'API, sans afficher le jeton :

```powershell
$headers = @{ Authorization = "Bearer $env:DIRECTUS_ADMIN_TOKEN" }

$projectFields = (Invoke-RestMethod -Uri "http://localhost:8055/fields/PROJETS" -Headers $headers).data
$projectFields |
  Where-Object { $_.field -in @("type_projet", "provinces", "business_plan") } |
  Select-Object field, type, @{Name="nullable"; Expression={$_.schema.is_nullable}}

$investorFields = (Invoke-RestMethod -Uri "http://localhost:8055/fields/investisseurs" -Headers $headers).data
$investorFields |
  Where-Object { $_.field -in @("secteur", "province", "pays", "fonction") } |
  Select-Object field, type, @{Name="nullable"; Expression={$_.schema.is_nullable}}

Remove-Variable headers, projectFields, investorFields
```

Les champs `type_projet`, `provinces`, `secteur` et `province` doivent exister. `pays` doit avoir `nullable = True`. `fonction` doit toujours exister en base.

### Étape 9 — Reconstruire et contrôler l'application

```powershell
docker compose up -d --build
docker compose restart directus
docker compose ps
docker compose logs --tail=150 directus
```

Les logs ne doivent pas contenir d'erreur de chargement des extensions.

Tester le frontend :

```powershell
docker compose exec frontend npm test
docker compose exec frontend npm run build
```

Tester la syntaxe des extensions modifiées :

```powershell
docker compose exec directus node --check /directus/extensions/directus-extension-acces-business-plan/dist/index.js
docker compose exec directus node --check /directus/extensions/directus-extension-demande-business-plan/dist/index.js
docker compose exec directus node --check /directus/extensions/directus-extension-espace-investisseur/dist/index.js
docker compose exec directus node --check /directus/extensions/directus-extension-exigences-projets/dist/index.js
docker compose exec directus node --check /directus/extensions/directus-extension-projets-publics/dist/index.js
```

Tester l'outil d'import Excel sans importer de données :

```powershell
Push-Location .\tools\import-projets-excel
npm ci
npm test
Pop-Location
```

Résultats automatisés déjà obtenus avant livraison : six tests réussis et build Vite réussi.

### Étape 10 — Vérifications fonctionnelles manuelles

Dans Directus et sur le frontend :

1. vérifier les nouveaux champs du modèle de données ;
2. créer un brouillon incomplet et confirmer qu'il est conservé ;
3. essayer de le passer à `publie` et vérifier que la publication est refusée avec la liste des champs manquants ;
4. compléter les six champs métier, puis publier ;
5. créer un projet avec une province et un autre avec deux provinces ;
6. tester les quatre filtres Province dans le catalogue ;
7. vérifier que l'ancien champ `province` reste pris en charge ;
8. créer et modifier un compte investisseur avec Secteur et Province ;
9. vérifier que les nouveaux formulaires ne demandent plus Pays et Fonction ;
10. tester les modes Business Plan `desactive`, `direct` et `validation` avec un PDF puis un HTML fictif ;
11. confirmer que le HTML est téléchargé comme pièce jointe et n'est jamais rendu dans la plateforme.

### Étape 11 — Import Excel, uniquement lorsqu'un vrai fichier est prêt

Le fichier Excel n'est jamais importé directement. Commencer par un dry-run :

```powershell
$excelPath = Read-Host "Chemin complet du fichier Excel à analyser"
Test-Path $excelPath

Push-Location .\tools\import-projets-excel
node .\import.mjs $excelPath
Pop-Location
```

Analyser le rapport : lignes complètes/incomplètes, champs manquants, doublons et erreurs. `Catégorie` est volontairement ignorée et ne permet pas de déduire `type_projet`.

Seulement après validation du rapport :

```powershell
Push-Location .\tools\import-projets-excel
node .\import.mjs $excelPath --apply
Pop-Location
```

Tous les projets importés sont créés en `brouillon`. Un `code_projet` déjà présent est ignoré et aucun projet existant n'est écrasé silencieusement.

### Étape 12 — Créer le snapshot final et le pousser

Après toutes les validations :

```powershell
docker compose exec directus node /directus/cli.js schema snapshot /directus/schema_apres_exigences_cri.yaml

docker compose cp directus:/directus/schema_apres_exigences_cri.yaml .\schema\schema_apres_exigences_cri.yaml

Get-Item .\schema\schema_apres_exigences_cri.yaml | Select-Object FullName, Length, LastWriteTime

git status
git add .\schema\schema_apres_exigences_cri.yaml
git commit -m "schema: snapshot after CRI requirements migration"
git push origin feat/mise-a-jour-exigences-cri
```

Ne pas ajouter `supabase_migration/` au commit.

### Étape 13 — Supprimer le jeton temporaire

Après le snapshot et les dernières vérifications :

```powershell
Remove-Item Env:DIRECTUS_ADMIN_TOKEN -ErrorAction SilentlyContinue
```

Retourner ensuite dans le profil administrateur Directus, supprimer ou régénérer le jeton statique temporaire, puis enregistrer. Le fonctionnement normal de la plateforme n'a pas besoin de ce jeton administrateur.

## 6. Dépannage ciblé

### Le dry-run affiche encore `403` sur `/fields/PROJETS/type_projet`

Le conteneur utilise encore l'ancienne copie du script. Vérifier le commit et recopier le fichier :

```powershell
git log --oneline -8
docker compose cp .\migrations\apply-exigences-cri.mjs directus:/directus/apply-exigences-cri.mjs
```

Le commit `7f1abd5` doit apparaître dans l'historique affiché.

### `/users/me` renvoie `401`

Le jeton est absent, incorrect ou remplacé dans Directus. Le ressaisir avec `-AsSecureString`. Ne pas l'afficher pour le diagnostiquer.

### `/users/me` renvoie seulement l'identifiant

Redémarrer uniquement Directus puis retester :

```powershell
docker compose restart directus
```

### Une commande de migration échoue

Ne pas relancer au hasard et ne pas restaurer immédiatement la base. Conserver la sortie complète et vérifier d'abord si l'erreur s'est produite avant ou après une ligne `Créé`/`Mis à jour`. Le script est conçu pour être relançable, mais toute relance après une application partielle doit être décidée à partir de cette sortie.

## 7. Retour arrière prudent

Revenir à `main` désactive le nouveau code, mais les champs ajoutés restent volontairement en base afin d'éviter toute perte :

```powershell
git switch main
docker compose up -d --build
docker compose restart directus
```

Ne jamais utiliser :

```text
docker compose down -v
```

Cette commande supprimerait le volume PostgreSQL. La restauration de `backups\avant_exigences_cri.sql` est une opération destructive qui ne doit être préparée qu'après diagnostic et confirmation explicite.
