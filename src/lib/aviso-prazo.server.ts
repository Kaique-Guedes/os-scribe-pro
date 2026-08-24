// Roda 1x por dia via Cloudflare Cron Trigger (ver `scheduled` em src/server.ts).
// Não é uma createServerFn porque ninguém chama isso pelo navegador — é o
// próprio Worker que dispara sozinho, no horário configurado.

import { emailsPorRoles, enviarEmail } from "@/lib/email.server";

function hojeMaisSete(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function enviarAvisosPrazoEntrega() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const dataAlvo = hojeMaisSete();

  const { data: os, error } = await supabaseAdmin
    .from("ordens_servico")
    .select("id, numero_os, numero_pedido, data_entrega_prev, clientes(nome)")
    .eq("data_entrega_prev", dataAlvo)
    // Só avisa quem ainda está em produção — não faz sentido avisar sobre
    // prazo de uma O.S. que já foi entregue/faturada/cancelada.
    .not("status", "in", "(entregue,faturado_parcialmente,faturado,cancelada)")
    // Idempotência: se o cron já rodou hoje pra essa O.S., não repete.
    .or(`aviso_prazo_enviado_em.is.null,aviso_prazo_enviado_em.neq.${dataAlvo}`);
  if (error) throw new Error(error.message);
  if (!os || os.length === 0) return { enviadas: 0 };

  const destinatarios = await emailsPorRoles(["admin", "pcp"]);
  if (destinatarios.length === 0) return { enviadas: 0 };

  const linhas = os
    .map(
      (o) =>
        `<li><b>O.S. ${o.numero_os}</b> — Cliente: ${o.clientes?.nome ?? "—"} — Pedido: ${o.numero_pedido ?? "—"} — Entrega prevista: ${dataAlvo.split("-").reverse().join("/")}</li>`,
    )
    .join("");

  const html = `
    <p>As O.S. abaixo têm entrega prevista para daqui a <b>1 semana</b> (${dataAlvo.split("-").reverse().join("/")}):</p>
    <ul>${linhas}</ul>
  `;

  await enviarEmail({
    to: destinatarios,
    subject: `Aviso: ${os.length} O.S. com entrega prevista em 1 semana`,
    html,
  });

  await supabaseAdmin
    .from("ordens_servico")
    .update({ aviso_prazo_enviado_em: dataAlvo })
    .in("id", os.map((o) => o.id));

  return { enviadas: os.length };
}
