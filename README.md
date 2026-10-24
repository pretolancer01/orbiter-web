# Orbiter Desktop

Cliente independente de comunicação para Windows e navegador. O executável portátil se conecta automaticamente ao serviço online em `https://orbiter-web.onrender.com`; use nele o mesmo e-mail e senha do site. A sessão de login é separada em cada dispositivo. O projeto não acessa a conta nem os protocolos privados do Discord.

Para testar o site no plano gratuito do Render, veja [RENDER.md](RENDER.md). A configuração de implantação está em `render.yaml`; os dados de teste podem ser perdidos quando o serviço reinicia.

## Interface

O início mostra comunidades e ações rápidas. Dentro de um canal de voz, a chamada ocupa a área principal; o chat abre pelo ícone ao lado do nome do canal. Em telas pequenas, use ☰ para abrir comunidades e canais e o botão de membros no cabeçalho para ver quem está na sala. As configurações concentram perfil, cores, personalização, testes de áudio e vídeo e saída da conta. Em **Áudio e vídeo**, escolha **Pressione para falar** e defina uma tecla; depois ative o microfone no canal. A voz é enviada somente enquanto a tecla estiver pressionada. Essa tecla funciona com a janela do Orbiter em primeiro plano e não interrompe a digitação em campos de texto. O botão direito abre ações do Orbiter em comunidades, canais, pessoas, mensagens e na área de chamada; campos de texto preservam o menu de edição do navegador.

Uma pessoa pode compartilhar a tela pelo computador e outra assistir no navegador do celular. O teste automatizado cobre a recepção de vídeo em um navegador mobile emulado; a reprodução em aparelhos físicos e redes diferentes ainda precisa de validação manual.

## Executar

```powershell
npm install
npm start
```

Para testar a lógica sem a interface: `npm test`. Para gerar um executável portátil: `npm run pack`. O arquivo fica em `dist/Orbiter 0.2.5.exe`. Basta baixá-lo e abrir no Windows; é necessária conexão com a internet. Como o serviço usa o plano gratuito do Render, a primeira abertura após inatividade pode demorar. Se a conexão cair, o aplicativo tenta reconectar automaticamente e mantém o botão de login indisponível até o serviço voltar.

Para usar outro servidor, defina `ORBITER_SERVER_URL=wss://seu-servidor` antes de abrir o executável. Para iniciar um servidor local junto com o executável, defina `ORBITER_LOCAL_SERVER=1`. O backend também pode ser iniciado separadamente com `npm run server`; por padrão, ele escuta apenas em `127.0.0.1`. Nesse modo, o arquivo persistente `orbiter.json` fica no diretório de dados configurado.

## Acesso entre computadores

O executável e o site compartilham o mesmo backend hospedado no Render. `ORBITER_HOST` e `ORBITER_PORT` alteram a escuta do backend quando iniciado separadamente. `ORBITER_INVITE_BASE_URL` define a base de links de convite públicos. O aplicativo busca as credenciais temporárias de TURN no backend, sem guardar a chave de API no cliente.

## Google OAuth

O botão usa navegador externo, Authorization Code com PKCE, retorno em loopback e validação de ID token pela biblioteca `google-auth-library`. Para habilitar:

1. Crie um projeto e uma credencial OAuth no Google Cloud Console adequada ao fluxo com retorno loopback.
2. Configure `GOOGLE_CLIENT_ID` no backend. Configure `GOOGLE_CLIENT_SECRET` somente se a credencial escolhida exigir esse valor.
3. Registre o URI `http://127.0.0.1:8766/oauth2/callback` na configuração OAuth e ajuste `ORBITER_OAUTH_PORT` se usar outra porta.
4. Reinicie o aplicativo/backend. Faça um teste real com uma conta autorizada.

Sem credenciais, o botão informa que a função está pendente; nenhum sucesso é simulado. O retorno loopback funciona apenas quando o navegador e o backend estão no mesmo computador. Para infraestrutura remota, é necessário criar um endpoint de retorno público, ajustar o fluxo e testá-lo antes de oferecer login Google remoto.

## Limites do protótipo

- Contas usam `scrypt` com sal; sessões usam tokens aleatórios guardados criptografados pelo `safeStorage` do Electron no cliente. O backend online usa PostgreSQL quando `DATABASE_URL` está configurada. É um protótipo, sem verificação de e-mail ou recuperação de senha.
- Comunidades possuem proprietário, cargos e permissões administrativas no backend. A interface oferece criação, canais, convites, expulsão e banimento básicos. Solicitação de aprovação para comunidades privadas, edição completa de cargos, amizade com mensagens diretas e compartilhamento de arquivos ainda precisam de interface e testes completos.
- Voz e tela usam WebRTC e seleção explícita da fonte de captura do Electron. O teste automatizado cobre mensagens e sinalização, mas áudio, vídeo, áudio do sistema, várias redes e metas de resolução ainda requerem verificação manual em dois computadores reais.
- Não há integração com servidores reais do Discord. Qualquer futura integração deve usar OAuth2/API oficiais e permissões concedidas.
- Denúncias são registradas no log do operador; moderação e proteção de menores precisam de infraestrutura e políticas adicionais antes de uso público. O acesso atual é destinado a adultos em ambiente de teste.

## Referências de arquitetura

- [Electron desktopCapturer](https://www.electronjs.org/docs/latest/api/desktop-capturer/)
- [MDN WebRTC signaling](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling)
- [Discord OAuth2](https://discord.com/developers/docs/topics/oauth2)
- [Vesktop](https://github.com/Vencord/Vesktop) é GPL-3.0-or-later; foi usado apenas como referência pública, sem copiar código.
