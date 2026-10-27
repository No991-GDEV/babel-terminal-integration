# Babel — Terminal Integration · 0.7.1

## Instalação pelo GitHub

Use este endereço em **Manifest URL** na instalação de módulos do Foundry ou no recurso equivalente do host:

`https://github.com/No991-GDEV/babel-terminal-integration/releases/latest/download/module.json`

Ele permanece igual nas próximas versões. O manifesto aponta para o ZIP específico de cada release. Depois da primeira instalação por esse endereço, use a verificação normal de atualizações; não será necessário reenviar o ZIP ao Sqyre.

Quem já usa o ZIP manual deve fazer backup e instalar a versão do manifesto mantendo o mesmo identificador `babel-terminal-integration`. Não execute `maintenance` nem remova Journals para atualizar. Reinicie o Foundry e recarregue os clientes. Credenciais, permissões e correspondências continuam no mundo. Atualizações da lore passam separadamente pelo importador e não substituem silenciosamente edições locais.

O responsável pelo projeto confirmou testes de uso local, importação no Sqyre e conta de jogador antes desta publicação. A configuração do manifesto remoto não altera as regras nem o funcionamento desses recursos; teste cada atualização numa cópia antes de aplicá-la à mesa principal.

## Novidades desta versão

Só há **Console** e **Painel**. Novas preferências, e preferências antigas do modo Misto, usam Console. Para trocar: `mode panel` ou `mode cli`. No Console, `help` lista comandos; no Painel, Ajustar terminal mostra as duas opções.

A estática leve pode ser desligada com `settings static off`, ou ligada com `settings static on`. Ela não captura cliques e é desativada pela redução de movimento. `settings sound on` habilita os sons de interface e o sinal curto ao carregar imagens; volume zero ou redução de movimento silenciam esse sinal.

### Pastas nativas, acessos e senhas

Ao abrir o mundo como mestre, os Journals gerenciados são organizados sob **Babel** na aba Journals. Importações e alterações seguintes acompanham suas pastas. Texto, imagens, IDs e permissões não são reescritos por essa organização. Journals registrados diretamente que já estejam em pastas autorais externas mantêm essa localização. Se um caminho ultrapassar quatro níveis nativos, a parte final é reunida no nome da última pasta; o caminho virtual não muda.

Configuração privada, contatos, cifras e lixeira ficam em pastas de sistema ocultas na lista. A organização não concede acesso. Jogadores continuam usando somente o terminal para navegar.

No arquivo aberto, **Acesso e credencial** mostra quem tem acesso e quantas páginas consegue ler. Pelo Console: `access`, `grant "Jogador"` e `revoke "Jogador"`.

`passwd show` exibe a senha do documento e de suas pastas; **Ver / copiar senhas** faz o mesmo no Painel. `passwd folder` consulta a pasta atual; `passwd folder /companhias/kruger` consulta um caminho escolhido. `passwd group show` consulta o grupo do arquivo aberto. O campo é selecionável e há um botão Copiar; se o navegador impedir a área de transferência, use Ctrl+C.

Senhas geradas são guardadas exclusivamente na administração privada do mestre, fora do pacote e de flags públicas. São senhas ficcionais, nunca senhas de contas. Cada documento e pasta recebe uma chave estável; uma chave individual gerada não bloqueia as coletivas. Uma senha individual exclusiva definida com `passwd` continua sendo exceção às chaves de grupo/pasta. `passwd inherit` remove essa exceção.

Senhas anteriores salvas somente como hash continuam válidas, mas não podem ser recuperadas em texto. Para vê-las depois, defina uma nova. Renomear ou mover uma pasta leva suas credenciais junto; não muda acessos já concedidos. Arquivos novos continuam pendentes mesmo numa pasta já acessada. Aprovar não concede acesso automaticamente: entregue a senha ou use Grant.

### Limpar os Journals de teste

A reinstalação limpa dos **arquivos do módulo** é independente da limpeza dos **Journals do mundo**. Não apague bancos de dados manualmente.

1. Faça um backup completo do mundo. Abra **Painel do mestre → Backup / instalação limpa**, ou `maintenance`.
2. Clique **Exportar backup e conferir limpeza**, ou digite `maintenance backup`. Confira o JSON salvo em Downloads; ele inclui TODOS os Journals, pastas, permissões e dados privados. Não publique esse arquivo.
3. Só depois confirme digitando `LIMPAR identificador-do-mundo`, exatamente como exibido. Isso retira TODOS os Journals daquele mundo, inclusive os de outros módulos; não remove cenas, fichas ou correspondências. Se qualquer Journal tiver mudado depois do backup, a operação é cancelada.
4. Use `import install` e confirme para instalar os 103 documentos atuais, com 80 imagens. O importador é opcional e não aprova ou libera os arquivos. Não reinstala os exemplos antigos.

Para recuperar, use **Restaurar backup de Journals** ou `maintenance restore`, selecione o JSON e confirme. A restauração exige Journals vazios, conserva IDs e rejeita conflitos de pastas; se já importou o novo acervo, faça outro backup antes de limpá-lo. O backup de Journals não copia imagens autorais externas nem substitui um backup completo do mundo.

O módulo funciona sem importar a lore de Babel. Ativá-lo não cria o acervo nem libera arquivos aos jogadores. Terminal e Obsidian Bridge não são dependências.

## Tela e comandos

Em **Ajustar terminal**, escolha Console (padrão) ou Painel. O painel usa menus com seleção invertida, texto verde e detalhes na cor da instituição. Linhas de tela e brilho discreto acompanham a opção de efeitos; reduzir movimento mantém a leitura estável.

O painel tem uma moldura industrial e assinaturas próprias para as oito companhias. Cabeçalhos, símbolos e carimbos fazem parte da apresentação: não mudam o texto do Journal. O modo de comandos mantém sua tela simples, sem essa moldura ou os carimbos.

As ações de criação, registro de Journal, pastas e lixeira estão em **Arquivos → Ferramentas do mestre**. Inserir credencial continua fora desse menu. Os comandos equivalentes continuam disponíveis; edição e permissões permanecem no documento aberto.

Com efeitos e animações ligados, há uma entrada curta ao abrir a estação. Esc ou **Pular** encerra a entrada; escolher outra seção também a cancela. Símbolos ASCII e anexos animam apenas na primeira exibição de cada um nessa janela. Esc pula a varredura dos anexos. Velocidade zero, efeitos desligados ou redução de movimento tornam a apresentação imediata. A animação de entrada do minigame continua anterior ao início do relógio; os caracteres decorativos não oferecem tentativas ou pistas extras.

O modo de comandos mostra uma sessão contínua, com o prompt abaixo da saída e a pasta atual em `usuário@babel:/pasta $`. `cd` muda a pasta, `ls` lista seu conteúdo, `pwd` mostra o caminho e `cat` lê o arquivo. Tab completa nomes disponíveis; ↑ e ↓ percorrem os comandos e devolvem o texto que você estava digitando ao chegar ao fim do histórico.

`Ctrl+L` ou `clear` limpa a tela, `Ctrl+U` apaga a linha que está digitando e `Ctrl+C` cancela a entrada. Esc também continua funcionando. Durante o puzzle, os comandos ficam na base da tela para que as palavras e o relógio permaneçam acessíveis.

A saída anterior fica apenas nessa janela durante a sessão. Senhas digitadas, corpos de correspondência, conteúdo recuperado de cifras e formulários em edição não são copiados para essa saída anterior. O histórico de comandos mantém as omissões já existentes para entradas privadas.

## Importar o mundo

1. Faça backup do mundo do Foundry, incluindo dados e imagens. Teste primeiro numa cópia.
2. Abra o terminal pela aba Journals. Como mestre, entre em **Painel do mestre → Importar acervo**, ou digite `import`.
3. Confira as prévias. É possível buscar por título, escolher uma categoria ou importar os resultados de toda a lista. O botão informa quantos arquivos serão importados, incluindo os que estão nas outras páginas da busca.
4. Confirme a importação. O lote completo contém **103 documentos e 80 imagens distintas**: 37 pessoas, 25 lugares, 9 notas de companhias, 6 de famílias, 12 de instituições e facções e 14 de Espectros e Arcanos. Esses totais incluem índices temáticos.
5. Abra cada arquivo que quiser disponibilizar e use **Acesso e credencial** para aprovar, configurar senha ou conceder acesso individual. Importar não faz essa liberação.

Comandos equivalentes: `import category companhias`, `import install companhias`, `import install`. As instalações em lote pedem confirmação; `cancel` cancela. Use `ls`, `cd companhias/kruger` e `cat kruger-energy-corp.txt` para navegar. Pastas organizam; grupos reúnem arquivos que podem usar a mesma credencial. São coisas diferentes.

O texto fica em Journals reais: uma página de texto por documento e páginas separadas para as imagens. O terminal lê essas páginas; o efeito de digitação não divide o Journal. **Editar arquivo**, ou `edit caminho/arquivo.txt`, permite alterar o texto. `journal` abre o original para o mestre. Journals com várias páginas autorais continuam tendo navegação por página.

## O que ficou fora

Não entram os blocos do Mestre, referências editoriais, preparação de sessões, backgrounds privados de jogadores nem as revelações identificadas fora dos callouts. Algumas imagens ligadas a essas revelações também foram omitidas. O Obsidian original não é alterado. Esta é uma seleção para descoberta em jogo, não uma cópia integral do cofre.

As referências entre documentos só aparecem no terminal quando o usuário também pode ler o destino. Permissões escondem arquivos dentro da mesa; **não protegem o conteúdo de alguém que tenha os arquivos do módulo**. Não coloque segredos exclusivos do Mestre no pacote distribuído.

## Atualizar e retirar os testes anteriores

Instalar uma versão do módulo não altera os Journals. Na tela de importação, arquivos sem mudanças locais podem receber a nova versão. Arquivos editados aparecem como **Edição local** e são ignorados no lote. Abra a prévia para comparar; substituir exige confirmação e guarda uma cópia privada. Faça também um backup externo do mundo: o histórico interno é limitado.

O perfil da Kruger mantém o mesmo identificador. Se você escreveu “TESTE” ou fez outra alteração, ela será preservada até autorizar a substituição. Arquivos novos continuam pendentes, mesmo quando o grupo já possui senha.

Use **Revisar arquivos do piloto**, ou `import cleanup`, para examinar as quatro notas antigas separadas da Kruger. A retirada é individual, confirmada e recuperável pela lixeira (`trash`; `restore nome-do-arquivo.txt`). Não apaga correspondências, cifras ou documentos criados por você. Esses registros antigos não fazem parte da nova importação; enquanto não os retirar, continuam no mundo conforme suas permissões atuais.

Para criar material novo, use **Arquivos → Ferramentas do mestre → Novo documento**, `edit` sem argumento, ou **Registrar Journal** / `journal register` para vincular um original existente. Revise texto, imagens e permissões antes de liberar. A edição local não retorna automaticamente ao Obsidian.

## Instalação e recuperação

Com o Foundry encerrado, extraia a pasta `babel-terminal-integration` do ZIP na pasta `Data/modules` do seu servidor. Preserve uma cópia da versão anterior e do mundo. Não substitua pastas de mundos ou sistemas. Reinicie o Foundry e recarregue o navegador após instalar.

No Sqyre, prefira instalar pelo manifesto remoto acima usando o mecanismo disponibilizado pelo host. O ZIP continua disponível em cada release para recuperação manual. Esta versão não atualiza o Foundry, SF2e ou outros módulos.

Se algo falhar durante a importação, confira quais títulos chegaram antes de repetir: os identificadores evitam duplicação. Não apague Journals para tentar corrigir. Para uma reversão completa, restaure o backup do mundo junto com a versão anterior do módulo. Trocar apenas os arquivos do módulo não desfaz alterações já gravadas no mundo.

A publicação inclui somente a seleção aprovada para jogadores, sem backups, cofre original, dados dos mundos ou relatórios privados. A procedência informada das artes e as licenças das bibliotecas/fontes estão registradas em `THIRD-PARTY-NOTICES.md`.
