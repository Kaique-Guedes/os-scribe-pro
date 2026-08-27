import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { escapeHtml } from "@/lib/html-utils";
import { z } from "zod";

// Lista fixa de e-mails internos (Sartori) que também recebem a pesquisa,
// além do e-mail do cliente cadastrado na O.S.
const DESTINATARIOS_INTERNOS = [
  "cristinaluscher@sartorigroup.com.br",
  "deivissonsouza@sartorigroup.com.br",
  "kaiqueguedes@sartorigroup.com.br",
  "lucaskary@sartorigroup.com.br",
  "juniorsilva@sartorigroup.com.br",
  "wallissonarthuso@sartorigroup.com.br",
  "izabelarodrigues@sartorigroup.com.br",
];

const LINK_PESQUISA = "https://forms.office.com/r/wrRxYpiBt0";

const Input = z.object({ osId: z.string().uuid() });

export const enviarPesquisaSatisfacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { enviarEmail } = await import("@/lib/email.server");

    // Guarda de idempotência ATÔMICA: o UPDATE só afeta a linha se
    // `pesquisa_satisfacao_enviada_em` ainda for null. Se duas requisições
    // chegarem "ao mesmo tempo" (ex: duplo clique, duas abas), só uma delas
    // recebe a linha de volta em `.select()` — essa é a que manda o e-mail.
    // Checar status=faturado e depois enviar em dois passos separados teria
    // uma condição de corrida (race condition); fazer os dois no mesmo UPDATE
    // fecha essa brecha.
    const { data: os, error } = await supabaseAdmin
      .from("ordens_servico")
      .update({ pesquisa_satisfacao_enviada_em: new Date().toISOString() })
      .eq("id", data.osId)
      .eq("status", "faturado")
      .is("pesquisa_satisfacao_enviada_em", null)
      .select("numero_os, numero_pedido, clientes(email)")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!os) return { enviado: false }; // não estava faturado, ou já tinha enviado antes

    const numeroPedido = os.numero_pedido || os.numero_os;
    const emailCliente = os.clientes?.email;
    const destinatarios = [...new Set([...(emailCliente ? [emailCliente] : []), ...DESTINATARIOS_INTERNOS])];

    const html = `
      <p>Prezado(a),</p>
      <p>Estamos enviando uma pesquisa de satisfação ao cliente. Por favor responda.</p>
      <p>É muito importante para nós o retorno do nosso cliente.</p>
      <p>Pedido: <b>${escapeHtml(numeroPedido)}</b> — Ele pode ser respondido através do link:
        <a href="${LINK_PESQUISA}">${LINK_PESQUISA}</a></p>
      <p>Ou pelo QR Code:</p>
      <img src="https://flowguedes.com.br/pesquisa-satisfacao-qrcode.png" alt="QR Code da pesquisa de satisfação" width="220" />
    `;

    await enviarEmail({
      to: destinatarios,
      subject: `Pesquisa de Satisfação - ${numeroPedido}`,
      html,
    });

    return { enviado: true };
  });
