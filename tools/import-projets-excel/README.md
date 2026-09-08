# Import Excel des projets historiques

Le dry-run est le comportement par défaut. Le mapping ne dépend pas d’une égalité entre les en-têtes Excel et les champs Directus. `Catégorie` est volontairement ignorée : aucune correspondance Mega/Micro n’est supposée.

```powershell
cd .\tools\import-projets-excel
npm install
node .\import.mjs "C:\chemin\ancien-fichier.xlsx"
$env:DIRECTUS_ADMIN_TOKEN="JETON_TEMPORAIRE"
node .\import.mjs "C:\chemin\ancien-fichier.xlsx" --apply
Remove-Item Env:DIRECTUS_ADMIN_TOKEN
```

Les doublons `code_projet` sont sautés et tous les imports sont créés en `brouillon`.
