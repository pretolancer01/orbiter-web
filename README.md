# Orbiter

Orbiter é um protótipo independente de comunicação para navegador e Windows. Reúne comunidades, canais de texto e voz, mensagens e compartilhamento de tela. O aplicativo não acessa contas nem servidores do Discord.

- **Acesse o site:** https://orbiter-web.onrender.com/
- **Para rodar no Windows ou desenvolver:** veja [Executar localmente](#executar-localmente).
- **Para configurar o serviço online:** veja [RENDER.md](RENDER.md).

> O serviço usa o plano gratuito do Render e pode demorar para abrir depois de ficar inativo. Voz e transmissão entre aparelhos e redes diferentes ainda precisam de testes em dispositivos reais.

## Tutorial: primeira conversa

1. **Crie uma conta.** Abra o [Orbiter no navegador](https://orbiter-web.onrender.com/), clique em **Criar conta** e preencha nome de exibição, nome de usuário, e-mail e senha. Se já tiver conta, use **Entrar**. O login com Google exige configuração adicional do operador e pode estar indisponível.
2. **Crie uma comunidade.** Clique no botão **＋** na barra de comunidades, escolha **Criar meu servidor**, dê um nome e confirme. O Orbiter cria um canal de texto `# geral` e um canal de voz. A opção **Aprovação manual** ainda está em desenvolvimento; para começar, use **Por convite**.
3. **Convide outra pessoa.** Dentro da comunidade, clique em **⚙ Gerenciar servidor**, escolha **Gerar convite** e compartilhe o código. O convite gerado expira em 24 horas. A outra pessoa cria a própria conta, clica em **＋ → Entrar com convite** e cola o código. Um link só aparece quando o operador configura a URL de convites no servidor.
4. **Troque mensagens.** Abra um canal de texto, escreva no campo **Mensagem** e envie. Use o botão de chat ao lado do canal para mostrar ou ocultar a conversa enquanto estiver em uma chamada.
5. **Converse por voz.** Ambas as pessoas entram no mesmo canal de voz. Clique em **Ativar microfone** e permita o uso do microfone no navegador ou no Windows. Em **⚙ Perfil e configurações → Áudio e vídeo**, escolha o dispositivo e use **Testar microfone** e **Testar saída de áudio** antes da conversa.
6. **Compartilhe a tela.** No canal de voz, clique em **Compartilhar tela**, escolha a tela ou janela, revise a qualidade e confirme. Clique em **Encerrar transmissão** para parar. No navegador, a seleção de fonte e de áudio do sistema depende das permissões e dos recursos disponíveis. Quem assiste pode precisar clicar em **Ativar som**.

### Usar no celular

Abra a mesma URL HTTPS no navegador do celular e entre com uma conta própria. Toque em **☰** para escolher a comunidade e o canal; os botões do cabeçalho abrem o chat e a lista de membros. Você pode assistir à tela compartilhada pelo computador e tocar em **Tela cheia** para ampliar. A captura da própria tela pelo celular depende do navegador e não foi validada nesta versão.

### Pressione para falar

Em **⚙ Perfil e configurações → Áudio e vídeo**, selecione **Pressione para falar** e defina uma tecla. Ative o microfone no canal e segure a tecla para transmitir. No aplicativo para Windows, a tecla funciona enquanto a janela do Orbiter está em primeiro plano e não interrompe a digitação em campos de texto.

## O que está disponível

- Comunidades com convites, categorias, canais de texto e voz; o proprietário pode gerenciar canais, cargos e membros.
- Mensagens, lista de membros, pedidos de amizade básicos e ações de moderação.
- Chamadas de voz e compartilhamento de tela via WebRTC, com escolha de microfone, saída de áudio e câmera para teste.
- Perfil, status, aparência e menus de contexto. O botão direito abre ações em comunidades, canais, pessoas, mensagens e chamadas; campos de texto mantêm o menu de edição do navegador.
- A mesma conta pode ser usada no site e no executável para Windows. Cada dispositivo mantém sua própria sessão de login.

## Executar localmente

Requisitos: Node.js e npm. Na pasta do projeto:

```powershell
npm ci
npm start
```

Esse comando compila e abre o cliente Electron. Para executar testes automatizados, use `npm test`. Para gerar o executável portátil do Windows, use `npm run pack`; o arquivo é criado em `dist/Orbiter 0.2.5.exe`. Para iniciar somente o backend local, use `npm run server`; por padrão, ele escuta em `127.0.0.1`. Para testar a interface web localmente:

```powershell
$env:ORBITER_WEB='1'
$env:PORT='8890'
npm run web:dev
```

Depois abra `http://127.0.0.1:8890`. Encerre com Ctrl+C. Se você quiser apontar o executável para outro servidor, defina `ORBITER_SERVER_URL=wss://seu-servidor` antes de iniciá-lo. `ORBITER_LOCAL_SERVER=1` inicia um backend local junto com o executável.

## Implantação e dados

O [guia do Render](RENDER.md) explica a implantação, o PostgreSQL persistente e as variáveis de ambiente. Sem `DATABASE_URL`, os dados do plano gratuito podem desaparecer quando o serviço reiniciar. `ORBITER_INVITE_BASE_URL` habilita links de convite; sem ela, compartilhe o código. Para voz e tela entre redes diferentes, o backend pode usar credenciais temporárias de TURN geradas a partir de `CLOUDFLARE_TURN_KEY_ID` e `CLOUDFLARE_TURN_API_TOKEN`; mantenha essas chaves somente no servidor.

O login Google usa OAuth no navegador externo e requer `GOOGLE_CLIENT_ID`, callback adequado e configuração do backend. No ambiente web remoto, o callback precisa ser público; o retorno local em `127.0.0.1` serve apenas quando navegador e backend estão no mesmo computador. Sem essa configuração, use e-mail e senha.

## Limites atuais

Orbiter é um protótipo. Não há recuperação de senha nem verificação de e-mail. A aprovação manual de comunidades, a edição completa de cargos, mensagens diretas e arquivos ainda não estão concluídas. A voz e a transmissão precisam de validação manual em aparelhos físicos e redes diferentes; os testes automatizados cobrem sinalização e recepção de vídeo em navegador móvel emulado. Denúncias são registradas no log do operador, e o serviço ainda não tem uma infraestrutura completa de moderação. O acesso atual é destinado a adultos em ambiente de teste.

## Referências

- [Electron desktopCapturer](https://www.electronjs.org/docs/latest/api/desktop-capturer/)
- [MDN WebRTC signaling](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling)
- [Discord OAuth2](https://discord.com/developers/docs/topics/oauth2)
- [Vesktop](https://github.com/Vencord/Vesktop) é GPL-3.0-or-later e foi usado apenas como referência pública, sem copiar código.
