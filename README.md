# Babel — Terminal Integration

Terminal retrofuturista para Foundry VTT 14. Documentos, imagens, correspondência e desafios de decifração permanecem dentro da tela do terminal, com Console por comandos ou Painel. Inclui uma seleção opcional do mundo de Babel: 103 documentos e 80 imagens.

## Instalar e atualizar

Na instalação de módulos por **Manifest URL**, use:

```text
https://github.com/No991-GDEV/babel-terminal-integration/releases/latest/download/module.json
```

Depois da instalação inicial por esse endereço, use a verificação de atualizações do Foundry ou a opção equivalente do host. Não é necessário reenviar o ZIP a cada versão. A publicação de uma versão não inicia uma atualização automática durante a sessão.

Se você já instalou o ZIP manualmente, faça backup e instale a versão por esse manifesto, conservando o mesmo identificador `babel-terminal-integration`. Não apague o mundo nem execute a limpeza dos Journals para atualizar. Reinicie o Foundry e recarregue os clientes após a atualização.

Compatibilidade declarada: Foundry **14.365 a 14.x**, verificado localmente em **14.367**. As rolagens nativas de hacking usam SF2e. O restante do terminal não exige instalar Terminal, Holosuite ou Obsidian Bridge. Nenhuma atualização do Foundry, do sistema ou de outros módulos é feita pelo Babel.

## Uso

Abra pela aba Journals. Console é o padrão; `mode panel` e `mode cli` alternam as interfaces.

- `help`, `ls`, `cd pasta`, `cat arquivo.txt`, `search termo`.
- `mail`, `image anexo.png`, `ciphers`, `analyze arquivo.enc`, `john arquivo.enc`.
- Mestre: `import`, `edit`, `access`, `approve`, `passwd show`, `passwd folder`.
- `settings` mostra as preferências, incluindo sons, velocidade e estática opcional.

Ativar ou atualizar o módulo não importa a lore nem concede acesso aos jogadores. O mestre pode usar o terminal com conteúdo próprio ou importar Babel. Arquivos novos começam pendentes. Senhas são geradas e guardadas privadamente no mundo; o mestre consulta e copia as credenciais no arquivo ou na pasta.

Os Journals são a fonte de texto e permissões. Correspondências, credenciais e concessões são dados do mundo e não acompanham este repositório. Faça backup do mundo e dos arquivos autorais antes de atualizar. A importação de novas versões detecta conflitos; edições locais não são sobrescritas silenciosamente.

**Atenção:** o conteúdo deste repositório é público e pode ser lido fora do jogo. Permissões e senhas controlam a descoberta dentro da mesa, não o acesso aos arquivos publicados. Não inclua segredos exclusivos do mestre em releases.

## Guias e manutenção

- [Guia do mestre](MASTER-GUIDE.md): instalação, senhas, correio, importação e recuperação.
- [Publicação de versões](docs/PUBLICATION.md): preparar e publicar futuras atualizações sem reenviar o pacote ao host.
- [Histórico](CHANGELOG.md).
- [Recursos e licenças](THIRD-PARTY-NOTICES.md).

O repositório contém somente a seleção aprovada para publicação e testes portáteis do código. O cofre, ferramentas editoriais privadas, prévias antigas, relatórios locais e backups ficam fora dele.
