# Publicação e atualizações

O manifesto de instalação é permanente:

`https://github.com/No991-GDEV/babel-terminal-integration/releases/latest/download/module.json`

Cada manifesto aponta para um ZIP de uma versão específica. Releases publicadas não são sobrescritas; correções recebem nova versão. Assim, o endereço de instalação continua o mesmo, e a recuperação de versões anteriores permanece possível.

## Para quem mantém o projeto

Requisitos locais: Node.js 24, npm, Git, PowerShell e GitHub CLI autenticado na conta com permissão de escrita no repositório. Não é necessário conceder o escopo adicional `workflow`; este projeto publica por um script local e não instala GitHub Actions.

1. Faça as alterações no código aprovado. Na área de autoria, a lore vem da exportação revisada, nunca de uma cópia integral do cofre. Não coloque segredos, dados de jogadores ou senhas no repositório.
2. Escolha uma nova versão numérica, por exemplo `0.7.2`. Atualize `version` em `module.json`, `package.json` e no cabeçalho do lockfile. Em `module.json`, atualize somente o trecho versionado de `download`; mantenha `manifest` estável. Acrescente uma entrada ao `CHANGELOG.md`.
3. Rode `npm ci` e `npm test`. Revise os arquivos e faça um commit. Na área privada de autoria, sincronize a cópia pública somente depois da revisão.
4. `npm run release:prepare` monta uma nova pasta em `dist`, com ZIP, manifesto e checksums. O ZIP é montado exclusivamente com a lista de distribuição do projeto; não inclui testes, arquivos npm de desenvolvimento ou dados do mundo.
5. `npm run release:publish` testa novamente, monta o pacote, envia o commit e a tag, cria uma release em rascunho e envia os três arquivos. Só publica depois de conferir nomes, tamanhos e checksums devolvidos pelo GitHub. Se uma release da mesma versão já estiver publicada, o comando para sem alterá-la.
6. Verifique o manifesto e o download públicos sem autenticação. Teste a atualização num mundo de cópia, inclusive mantendo credenciais, permissões, correspondência e edições locais. Só depois atualize a mesa principal.

No Windows, também é possível executar diretamente:

```powershell
powershell -NoProfile -File tools/publish-release.ps1 -PrepareOnly
powershell -NoProfile -File tools/publish-release.ps1 -Publish
```

Se o GitHub CLI for portátil e não estiver no PATH, passe `-GitHubCli "caminho/para/gh.exe"`. Não coloque tokens na linha de comando, no manifesto ou em arquivos do repositório. A autenticação é feita pelo mecanismo normal do GitHub CLI.

## Para o mestre no Foundry/Sqyre

A primeira instalação precisa ser feita pelo manifesto acima. Quem já usa uma cópia manual pode fazer backup e instalar a versão do manifesto sobre o mesmo módulo. Não remova Journals nem mundos nessa transição.

Nas próximas versões, use a verificação de atualizações do Foundry ou o recurso equivalente do host. Atualizar o módulo troca seus arquivos, não o mundo. Novidades da lore são aplicadas separadamente no importador, preservando conflitos e mantendo documentos novos pendentes.

Para reverter, instale o manifesto de uma release anterior, disponível no histórico do GitHub. Se já houve mudança no mundo, restaurar só o módulo não desfaz essa mudança: use também o backup completo do mundo.

## Superfície pública

O pacote e o repositório são montados por listas explícitas de arquivos. Não entram: cofre Obsidian original, relatórios de exportação e seus caminhos de origem, backups, versões anteriores instaladas, ferramentas de autenticação, credenciais, configurações do mundo ou material exclusivo do mestre.

Bibliotecas e fontes conservam suas próprias licenças, incluídas no pacote. Publicar o código, a lore e as imagens não lhes atribui automaticamente uma nova licença aberta. Consulte `THIRD-PARTY-NOTICES.md`.
