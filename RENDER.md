# Orbiter no Render

O projeto inclui um site que abre diretamente no navegador por HTTPS. A mesma instância entrega a interface e aceita WebSocket na porta `PORT` fornecida pelo Render. O arquivo `render.yaml` usa somente o plano gratuito, para testes.

No plano gratuito, o arquivo local é temporário. Para manter contas, sessões, servidores e mensagens após reinícios, configure a variável `DATABASE_URL` com uma conexão PostgreSQL persistente. O Orbiter cria a tabela `orbiter_state` automaticamente. Senhas são armazenadas como hash com salt; a conexão com o banco fica apenas no backend. Se a conexão falhar, o serviço não inicia usando dados temporários por engano.

## Configurar o banco gratuito

1. Crie um projeto PostgreSQL no [Neon](https://console.neon.tech/) e copie a **connection string** com `sslmode=require`. Guarde a string em segredo.
2. No Render, abra **orbiter-web → Environment → Add Environment Variable**. Em **Key**, coloque `DATABASE_URL`; em **Value**, cole a string completa. Clique em **Save, rebuild, and deploy**.
3. Aguarde o status **Live**. Cadastre sua conta uma vez, saia e entre novamente com o mesmo e-mail e senha. Reinicie o serviço e confirme que a conta e os servidores continuam disponíveis.

As contas criadas antes de ativar o banco no Render podem já ter sido apagadas com o arquivo temporário. Nesse caso, cadastre-as uma última vez depois de configurar `DATABASE_URL`. Nunca publique a connection string no GitHub ou em capturas de tela.

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
