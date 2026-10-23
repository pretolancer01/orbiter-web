# Testar Orbiter entre dois computadores Windows

Esta pasta permite um teste privado pela internet. Ainda nao existe um servidor publico do Orbiter. O codigo de convite sozinho nao escolhe o computador anfitriao.

1. Os dois instalam o Tailscale e entram cada um na propria conta: https://tailscale.com/download/windows .
2. O anfitriao abre https://login.tailscale.com/admin/machines , escolhe seu computador e usa Share para compartilhar a maquina com o amigo. Envia o link de compartilhamento do Tailscale e o amigo aceita. Configure o acesso apenas para essa pessoa.
3. O anfitriao fecha o Orbiter atual e abre Abrir-Host.cmd nesta pasta. Isso usa o IP privado Tailscale do anfitriao e o banco de dados existente do aplicativo. A escuta fica somente no IP da VPN. Mantenha o computador ligado, o aplicativo aberto e o Tailscale conectado.
4. Envie esta pasta completa ao amigo por um servico de arquivos, inclusive Orbiter 0.2.2.exe, Conectar.ps1 e Abrir-Amigo.cmd. Um caminho C:\... deste computador nao e um link publico para download.
5. O amigo fecha qualquer copia anterior e abre Abrir-Amigo.cmd. Digita o IP Tailscale do anfitriao (100.x.x.x). Depois cria uma conta no Orbiter conectado ao anfitriao. Uma conta criada antes no banco local do amigo nao existe automaticamente no banco do anfitriao.
6. No Orbiter, o anfitriao gera um convite para a comunidade. O amigo usa Entrar com convite e cola esse codigo. Ambos selecionam o mesmo canal de voz. Os dois nomes devem aparecer abaixo do canal.
7. Primeiro testem mensagens. Depois ativem o microfone e compartilhem uma janela. O outro confirma imagem e audio recebido; invertam os papeis. Para testar audio do sistema, marquem essa opcao no seletor de compartilhamento.

Se o Windows pedir autorizacao de rede para o Orbiter, permita o acesso para a rede utilizada pela VPN. Se nao conectar, confirme Tailscale conectado e acesso compartilhado, aplicativo Host aberto e firewall. Nao e necessario abrir portas do roteador para este procedimento.

Este caminho foi preparado e os lancadores foram verificados estaticamente. O teste entre dois computadores e a passagem da midia pela VPN ainda precisam ser realizados por voces. A captura WebRTC pode exigir ajuste de firewall ou TURN se a midia nao chegar. A conexao de sinalizacao usa ws dentro da VPN criptografada; nao exponha este modo diretamente a internet.

Para voltar ao uso apenas local, feche o aplicativo e use o atalho Orbiter normal da area de trabalho. Contas e comunidades criadas neste teste ficam no computador anfitriao.

Documentacao: https://tailscale.com/docs/features/sharing
