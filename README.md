# Domi TV 📺

O canal de séries da Domi: coleção com todas as séries do catálogo do TMDB, marcação de episódios, Match de sugestões, retrospectiva mensal e importação do TV Time.

Tudo roda nos planos gratuitos. São 4 passos, uns 20 minutos no total.

---

## 1. Supabase (banco de dados e login)

1. Entre em **supabase.com** → **New project**. Dê o nome `domi-tv`, crie uma senha forte para o banco (guarde em algum lugar) e escolha a região **South America (São Paulo)**.
2. Quando o projeto terminar de criar, abra **SQL Editor → New query**, cole todo o conteúdo do arquivo `supabase/schema.sql` e clique em **Run**. Deve aparecer "Success".
3. **Quem pode entrar.** Em **Authentication → Users → Add user → Create new user**, crie o usuário com o e-mail da Domi, uma **senha** (é com ela que a Domi vai entrar no app) e marque **Auto Confirm User**. Se quiser, crie um para você também.
4. **Fechar a porta.** Em **Authentication → Sign In / Providers**, desligue **Allow new users to sign up**. A partir daí, só os e-mails que você criou conseguem entrar.
5. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public**. Você vai usar as duas no passo 3.

## 2. TMDB (catálogo de séries)

1. Crie uma conta em **themoviedb.org**.
2. Vá em **Configurações → API → Criar → Developer**, preencha o formulário (uso pessoal) e aceite os termos.
3. Copie a **Chave da API**. O **Token de leitura da API** também funciona.

## 3. Publicar na Vercel

1. Crie um repositório **privado** no **github.com** chamado `domi-tv` e envie esta pasta inteira para ele (o botão **uploading an existing file** aceita arrastar os arquivos).
2. Em **vercel.com → Add New → Project**, importe o repositório `domi-tv`.
3. Antes de clicar em Deploy, abra **Environment Variables** e adicione as três variáveis:

   | Nome | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL do Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave anon public do Supabase |
   | `TMDB_API_KEY` | chave do TMDB |

4. Clique em **Deploy**. Em cerca de 1 minuto sai um endereço como `domi-tv.vercel.app`.
5. Se quiser o endereço `domitv`, vá em **Settings → Domains** na Vercel e troque o nome do projeto, ou compre um domínio próprio e conecte por ali.

## 4. Instalar no celular dela

- **iPhone:** abra o endereço no **Safari** → botão **Compartilhar** → **Adicionar à Tela de Início**.
- **Android:** abra no **Chrome** → menu **⋮** → **Instalar app**.

O app abre em tela cheia, com o ícone do play azul.

---

## Segurança

- Cada linha do banco é amarrada à pessoa logada (Row Level Security). Mesmo com a chave pública, ninguém lê nem altera os dados de outra pessoa.
- Só entra quem você cadastrou no passo 1.3, e o cadastro aberto fica desligado.
- A chave do TMDB fica só no servidor. As buscas passam por `/api/tmdb`, que exige login.
- O app envia cabeçalhos de segurança (CSP, HSTS, nosniff) e não aparece no Google.
- **Backup:** no Supabase, em **Table Editor → shows → Export → CSV**. Assim os dados dela nunca ficam presos num app que pode fechar.

## Para desenvolver

```bash
cp .env.example .env.local   # preencha as três variáveis
npm install
npm run dev                  # http://localhost:3000
```
