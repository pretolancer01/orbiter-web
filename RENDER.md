# Orbiter no Render

O projeto inclui um site que abre diretamente no navegador por HTTPS. A mesma instância entrega a interface e aceita WebSocket na porta `PORT` fornecida pelo Render. O arquivo `render.yaml` usa somente o plano gratuito, para testes.

No plano gratuito, o arquivo local com contas, comunidades e mensagens é temporário. Reinícios, novos deploys e períodos de inatividade podem apagá-lo. Use contas e dados de teste. Para uso contínuo será necessário migrar o armazenamento para um banco persistente.

## Testar localmente

No PowerShell, dentro da pasta do projeto:

```powershell
$env:ORBITER_WEB='1'
$env:PORT='8890'
npm run web:dev
```

Abra `http://127.0.0.1:8890`. Para teste local, os dados padrão ficam em `data/`. Encerre o processo com Ctrl+C.

## Publicar

1. Crie um repositório Git privado contendo o conteúdo desta pasta `app` como raiz. Não inclua `node_modules`, `dist` nem `data`.
2. No Render, crie um Blueprint a partir desse repositório. Ele encontra `render.yaml` na raiz. Verifique que o plano exibido é **Free** e não há disco antes de criar.
3. Depois da implantação, abra a URL `https://...onrender.com`, cadastre uma conta de teste e crie uma comunidade. Compartilhe essa URL com seu amigo; ele cria outra conta de teste e usa o convite da comunidade.

O login Google permanece desabilitado no navegador até ter callback OAuth público e credenciais próprias. Microfone e captura de tela usam as permissões e o seletor do navegador. Conectividade WebRTC entre redes diferentes ainda pode exigir TURN; vídeo e áudio remotos precisam de teste em dois computadores. O serviço gratuito pode demorar a despertar após inatividade. A implantação no Render não foi executada nesta etapa.

Referências: https://render.com/docs/web-services , https://render.com/docs/websocket , https://render.com/docs/disks
