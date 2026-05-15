## Atualizar favicon do site

Substituir o favicon atual (`public/favicon.png`) pela nova imagem MK enviada.

### Passos
1. Copiar `user-uploads://12.png` para `public/favicon.png` (sobrescrevendo o atual).
2. Manter a referência já existente em `index.html`:
   ```html
   <link rel="icon" href="/favicon.png" type="image/png" />
   ```
   (Nenhuma alteração de código necessária — só troca do arquivo.)

### Observação
O navegador pode manter o favicon antigo em cache; um hard refresh (Ctrl+Shift+R) mostra o novo.