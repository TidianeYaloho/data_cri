# Migration des exigences CRI

Cette migration passe par l’API Fields officielle de Directus : elle ajoute les champs et leur configuration sans fabriquer un faux snapshot ni modifier directement les tables `directus_*`.

## Prévisualisation

La commande `schema apply --dry-run` n’est pas utilisée sur l’ancien snapshot global, car celui-ci peut être décalé par rapport à la base vivante. Vérifier d’abord les champs existants :

```powershell
docker compose exec directus node /directus/cli.js schema snapshot /directus/schema-avant-exigences.yaml
docker compose cp directus:/directus/schema-avant-exigences.yaml .\schema\schema-avant-exigences.yaml
```

## Application

Créer temporairement un jeton administrateur statique dans Directus, puis :

```powershell
$env:DIRECTUS_ADMIN_TOKEN="JETON_TEMPORAIRE"
node .\migrations\apply-exigences-cri.mjs
node .\migrations\apply-exigences-cri.mjs --apply
Remove-Item Env:DIRECTUS_ADMIN_TOKEN
```

Le script est idempotent et migre `province` vers `provinces` seulement lorsque le nouveau champ est vide.

## Rollback prudent

Revenir au code précédent suffit pour désactiver les nouvelles fonctions. Les nouveaux champs ne sont volontairement pas supprimés automatiquement afin de ne perdre aucune donnée. Ils peuvent être masqués dans Directus après retour du code. Ne pas appliquer un ancien snapshot global sans examiner son dry-run.
