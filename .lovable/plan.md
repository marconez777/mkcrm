# Reorganização do rodapé da sidebar

Arquivo único: `src/components/AppShell.tsx` (linhas ~276–380).

## Mudanças

### 1. Perfil (bloco do "mkartmarketing")
- Remover a bolinha de presença colorida sobre o avatar (o `<span>` absoluto com `presenceColor` e o `ring-black`).
- Remover a variável `presenceColor` (não usada em mais nenhum lugar).
- Manter avatar + nome + email + chevron do dropdown como estão.

### 2. Rodapé unificado (status + atalhos + idioma + perfil)
Envolver os dois blocos atuais (status WhatsApp e perfil) em um único container com borda superior sutil (`border-t border-white/10`) e padding consistente, para virarem uma "zona de conta" clara e separada da navegação.

Estrutura nova:

```text
┌─────────────────────────────┐
│ [●] Conectado    [⌨] [🌐]   │  ← linha 1: status + ações auxiliares
│ [Avatar] Nome         [⇅]   │  ← linha 2: perfil (sem bolinha)
│         email                │
└─────────────────────────────┘
```

Ajustes visuais:
- Container: `mt-2 border-t border-white/10 px-3 pt-3 pb-3 space-y-2`.
- Status pill (`Conectado`): mantém a bolinha animada — é o único indicador de conexão agora. Continua sendo o NavLink para `/settings` ou `/settings?qr=1`.
- Botão de atalhos (`Keyboard`) e `LanguageSwitcher`: mesmo tamanho/estilo do status pill (altura equalizada), agrupados à direita da mesma linha.
- Perfil: mesmo card atual, sem a bolinha; ring do avatar reduzido para `ring-1 ring-white/15` para leveza.

Sem mudanças de comportamento — apenas layout/estética. Nenhuma alteração em hooks, rotas ou dados.

## Fora do escopo
- Não mexer em `useHealth`, `LanguageSwitcher`, `ShortcutsDialog`.
- Não alterar navegação nem o `DropdownMenu` do perfil.
