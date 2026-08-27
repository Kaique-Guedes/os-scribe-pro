// Utilitário de segurança: escapa texto antes de inserir em HTML (e-mails).
//
// Por quê: qualquer texto digitado por usuário (observação, nome de cliente,
// número de pedido, etc.) que entra num template `html = \`...${valor}...\``
// sem passar por isso é uma injeção de HTML — alguém pode digitar
// `<a href="site-falso.com">clique aqui</a>` e o e-mail final vai renderizar
// um link clicável de verdade. Isso vira um vetor de phishing usando o
// domínio confiável da empresa (notificacoes@flowguedes.com.br).
//
// Regra: todo valor que (a) veio de input do usuário ou do banco e (b) vai
// para dentro de uma string HTML de e-mail, deve passar por escapeHtml()
// antes. Não precisa escapar o que a própria aplicação constrói (ex: URLs
// fixas como LINK_PESQUISA, tags HTML literais do template).
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
