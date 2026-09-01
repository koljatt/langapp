# VS Code -asetukset

Nämä kolme tiedostoa piti kirjoittaa `.vscode`-kansioon, mutta etätyökalut eivät saa kirjoittaa sinne. Luo kansio ja tiedostot käsin, jos haluat ne — projekti toimii ilmankin. Voit myös poistaa tämän tiedoston sen jälkeen.

## `.vscode/extensions.json`

Suositellut laajennukset, joita VS Code tarjoaa asennettavaksi projektin avatessa.

```json
{
  "recommendations": ["dbaeumer.vscode-eslint", "esbenp.prettier-vscode", "antfu.vite"]
}
```

## `.vscode/settings.json`

```json
{
  "editor.formatOnSave": true,
  "editor.tabSize": 2,
  "files.eol": "\n",
  "files.exclude": {
    "node_modules": true,
    "dist": true
  },
  "javascript.preferences.importModuleSpecifierEnding": "js",
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[css]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

`importModuleSpecifierEnding: "js"` on tässä olennainen: ilman sitä VS Coden automaattinen import kirjoittaa polun ilman `.js`-päätettä, eikä selain löydä moduulia.

## `.vscode/launch.json`

Debuggerin käynnistys Chromeen, kun `npm run dev` on käynnissä.

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Avaa Parliamo (vite dev)",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}"
    }
  ]
}
```
