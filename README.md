# Survivor

App web (PWA) de acompanhamento de alimentação, peso, passos e saúde, oferecido por convite. A especificação completa está em [docs/ESPECIFICACAO.md](docs/ESPECIFICACAO.md).

## O que a fase 1 tem

- Cadastro por link de convite, login com e-mail e senha.
- Consentimento LGPD (termos + dados de saúde), política de privacidade e termos de uso.
- Anamnese: dados do corpo, objetivo, rotina de treino, triagem de saúde (PAR-Q+) e remédios.
- Cálculo das metas diárias (calorias, proteína, gordura, carboidrato, fibra, água e sódio) com as regras por remédio.
- Tela Hoje: calorias restantes, macros, passos, peso, pressão arterial e sintomas (no modo cauteloso).
- Refeição por texto: a IA identifica alimentos e porções, os valores vêm da tabela TACO, e a pessoa confere antes de salvar.
- Histórico de 14 dias.
- Painel do administrador: convites, contas, números agregados e uso de IA. Sem acesso a dados de saúde.
- Conta: baixar todos os dados (JSON) e apagar a conta.

## Estrutura

```
src/lib/health/     cálculo das metas, catálogo de remédios, triagem (com testes)
src/lib/food/       cálculo de nutrientes e escolha do alimento na tabela (com testes)
src/lib/ai/         contrato da IA e adaptadores (Anthropic e compatível com OpenAI)
src/app/            telas e Server Actions
supabase/migrations esquema do banco, RLS e funções
scripts/            importação da TACO
```

## Instalação

### 1. Banco (Supabase self-hosted)

No SQL Editor do Supabase, rode na ordem:

1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_functions.sql`

A segunda usa as extensões `unaccent` e `pg_trgm`, que já vêm na imagem do Supabase.

### 2. Tabela TACO

O CSV já está pronto em `data/taco.csv`: 591 alimentos da TACO 4ª edição, convertidos da planilha oficial do NEPA/Unicamp (https://nepa.unicamp.br/publicacoes/tabela-taco-excel/). Para importar:

```bash
node --env-file=.env.local scripts/import-taco.mjs data/taco.csv
```

Ficaram de fora 6 alimentos que a TACO publica sem calorias analisadas (iogurte sabor abacaxi, leite desnatado UHT, leite integral, sal dietético, sal grosso e coco verde). O importador gravaria esses valores como 0 kcal. Para leite, a IA vai sugerir outro item da tabela ou usar a própria estimativa.

Se sair uma edição nova da planilha, gere o CSV de novo com `python scripts/taco-xlsx-to-csv.py Taco-4a-Edicao.xlsx data/taco.csv`.

Sem a TACO o app funciona, mas todos os itens ficam como "estimativa da IA".

### 3. Variáveis de ambiente

Copie `.env.example` para `.env.local` (desenvolvimento) ou cadastre as mesmas variáveis no Easypanel. As principais:

| Variável | Para quê |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Conexão com o Supabase |
| `APP_URL` | Endereço público, usado nos links de convite |
| `BOOTSTRAP_ADMIN_EMAIL` | Quem se cadastrar com esse e-mail vira administrador (só enquanto não houver nenhum) |
| `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY` | IA do modo padrão |
| `AI_DAILY_LIMIT` | Análises por pessoa por dia |

`AI_MODEL` vem como `claude-opus-5-5`. Para gastar menos, dá para trocar por `claude-sonnet-5-5` ou `claude-haiku-5-5`; o piloto deve mostrar qual acerta o suficiente nos pratos brasileiros. Com Opus 5.5 e Sonnet 5.5, o app liga o fallback automático do servidor da Anthropic para respostas recusadas.

### Supabase compartilhado com outros apps

O login (`auth.users`) é do Supabase inteiro, não de cada app. Por isso:

- Quem já tem login por causa de outro app se cadastra no Survivor com o mesmo e-mail e a mesma senha desse login. O Survivor confere a senha e só cria o perfil.
- O Survivor marca os logins que ele mesmo cria (`app_metadata.survivor_created`). Apagar a conta ou desativar uma pessoa só mexe no login quando essa marca existe. Nos outros casos, apaga ou bloqueia apenas os dados do Survivor, e o login continua valendo nos outros apps.

### 4. Rodar localmente

```bash
npm install
npm run dev
```

Abra http://localhost:3000/cadastro e crie a conta com o e-mail de `BOOTSTRAP_ADMIN_EMAIL`. Depois, gere convites em /admin.

Importante: assim que a sua conta de administrador existir, apague `BOOTSTRAP_ADMIN_EMAIL` das variáveis (no `.env.local` e no Easypanel). O cadastro não confirma o e-mail, então quem souber esse endereço poderia virar administrador se, um dia, não houver nenhum.

### 5. Publicar no Easypanel

Crie um app do tipo "Dockerfile" apontando para este repositório, cadastre as variáveis de ambiente e exponha a porta 3000 com HTTPS.

## Comandos

```bash
npm test          # testes de cálculo
npm run typecheck # TypeScript
npm run lint
npm run build
```
