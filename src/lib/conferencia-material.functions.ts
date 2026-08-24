import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function resolveEnv(key: string): Promise<string | undefined> {
  if (process.env[key]) return process.env[key];
  try {
    const cfWorkers = (await import("cloudflare:workers")) as { env?: Record<string, string> };
    return cfWorkers.env?.[key];
  } catch {
    return undefined;
  }
}

// ---------- Iniciar conferência ----------

const IniciarInput = z.object({ cotacaoId: z.string().uuid() });

export const iniciarConferencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IniciarInput.parse(d))
  .handler(async ({ data, context }) => {
    // Idempotente: se já existe conferência pra essa cotação, retorna ela (evita duplicar em clique duplo)
    const { data: existente } = await context.supabase
      .from("material_conferencias")
      .select("*, material_conferencia_itens(*)")
      .eq("cotacao_id", data.cotacaoId)
      .maybeSingle();
    if (existente) return existente;

    const { data: cotacao, error: cotErr } = await context.supabase
      .from("material_cotacoes")
      .select("id, os_id, categoria, descricao")
      .eq("id", data.cotacaoId)
      .single();
    if (cotErr) throw new Error(cotErr.message);

    const { data: itensCotacao, error: itensErr } = await context.supabase
      .from("material_cotacao_itens")
      .select("*")
      .eq("cotacao_id", data.cotacaoId);
    if (itensErr) throw new Error(itensErr.message);
    if (!itensCotacao || itensCotacao.length === 0) {
      throw new Error("Essa cotação não tem itens cadastrados — não é possível iniciar a conferência.");
    }

    const { data: conferencia, error: confErr } = await context.supabase
      .from("material_conferencias")
      .insert({
        os_id: cotacao.os_id,
        cotacao_id: cotacao.id,
        status: "em_andamento",
        iniciado_by: context.userId,
        iniciado_em: new Date().toISOString(),
      })
      .select()
      .single();
    if (confErr) throw new Error(confErr.message);

    const itensParaInserir = itensCotacao.map((it) => ({
      conferencia_id: conferencia.id,
      cotacao_item_id: it.id,
      descricao: it.descricao,
      quantidade_esperada: it.quantidade,
      unidade: it.unidade,
    }));
    const { data: itensConferencia, error: itensConfErr } = await context.supabase
      .from("material_conferencia_itens")
      .insert(itensParaInserir)
      .select();
    if (itensConfErr) throw new Error(itensConfErr.message);

    return { ...conferencia, material_conferencia_itens: itensConferencia };
  });

// ---------- Concluir conferência ----------

const ConcluirInput = z.object({
  conferenciaId: z.string().uuid(),
  itens: z.array(
    z.object({
      id: z.string().uuid(),
      veio_certo: z.boolean(),
      quantidade_recebida: z.number().nullable().optional(),
      observacao: z.string().nullable().optional(),
    }),
  ),
  observacoesGerais: z.string().nullable().optional(),
});

export const concluirConferencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ConcluirInput.parse(d))
  .handler(async ({ data, context }) => {
    // Grava o resultado item a item (RLS garante que só admin/pcp/producao/almoxarifado escrevem aqui)
    for (const item of data.itens) {
      const { error } = await context.supabase
        .from("material_conferencia_itens")
        .update({
          veio_certo: item.veio_certo,
          quantidade_recebida: item.quantidade_recebida ?? null,
          observacao: item.observacao ?? null,
        })
        .eq("id", item.id);
      if (error) throw new Error(error.message);
    }

    const resultado = data.itens.every((i) => i.veio_certo) ? "ok" : "divergente";

    const { data: conferencia, error: confErr } = await context.supabase
      .from("material_conferencias")
      .update({
        status: "concluida",
        resultado,
        observacoes: data.observacoesGerais ?? null,
        concluido_by: context.userId,
        concluido_em: new Date().toISOString(),
      })
      .eq("id", data.conferenciaId)
      .select("*, material_cotacoes(categoria, descricao), ordens_servico(numero_os)")
      .single();
    if (confErr) throw new Error(confErr.message);

    // Fecha a etapa "chegada_material" sozinha quando TODAS as conferências da O.S. estiverem concluídas
    const { data: todasConferencias, error: todasErr } = await context.supabase
      .from("material_conferencias")
      .select("status")
      .eq("os_id", conferencia.os_id);
    if (todasErr) throw new Error(todasErr.message);

    const todasConcluidas = (todasConferencias ?? []).every((c) => c.status === "concluida");
    if (todasConcluidas) {
      await context.supabase
        .from("os_etapas")
        .update({ status: "concluido", data: new Date().toISOString().slice(0, 10) })
        .eq("os_id", conferencia.os_id)
        .eq("tipo", "chegada_material");

      // Avança o status da O.S. sozinho quando todo o material já foi conferido.
      // Guard com .in(): só troca se ainda estiver em "aberta"/"aguardando_material" —
      // não sobrescreve um status que já avançou manualmente (em_pintura, entregue,
      // atrasada, cancelada etc.), pra não "voltar" uma O.S. que já passou dessa fase.
      // Usa o client admin (bypassa RLS) de propósito: quem dispara essa mudança é o
      // SISTEMA reagindo à conferência concluída, não uma edição livre do usuário —
      // o almoxarifado não tem (e não deve ter) permissão de UPDATE em ordens_servico.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("ordens_servico")
        .update({ status: "em_producao" })
        .eq("id", conferencia.os_id)
        .in("status", ["aberta", "aguardando_material"]);
    }

    // E-mail pra admin + pcp (best-effort: se falhar, não derruba a conclusão da conferência)
    try {
      await enviarEmailConferencia(conferencia, data.itens, resultado);
      await context.supabase
        .from("material_conferencias")
        .update({ email_enviado: true })
        .eq("id", data.conferenciaId);
    } catch (e) {
      console.error("[conferencia] falha ao enviar e-mail:", e);
    }

    return { ...conferencia, todasConcluidas };
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function enviarEmailConferencia(conferencia: any, itens: z.infer<typeof ConcluirInput>["itens"], resultado: "ok" | "divergente") {
  const resendKey = await resolveEnv("RESEND_API_KEY");
  if (!resendKey) {
    console.warn("[conferencia] RESEND_API_KEY ausente — e-mail não enviado.");
    return;
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Só admin e pcp têm acesso de leitura a user_roles de outras pessoas — por isso usamos o client admin aqui.
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .in("role", ["admin", "pcp"]);
  const userIds = [...new Set((roles ?? []).map((r) => r.user_id))];
  if (userIds.length === 0) return;

  const { data: perfis } = await supabaseAdmin.from("profiles").select("email").in("id", userIds);
  const destinatarios = (perfis ?? []).map((p) => p.email).filter((e): e is string => !!e);
  if (destinatarios.length === 0) return;

  const numeroOs = conferencia.ordens_servico?.numero_os ?? conferencia.os_id;
  const categoria = conferencia.material_cotacoes?.categoria ?? "";
  const descricao = conferencia.material_cotacoes?.descricao ?? "";
  const divergentes = itens.filter((i) => !i.veio_certo);

  const assunto =
    resultado === "ok"
      ? `Material conferido OK — O.S. ${numeroOs} (${categoria})`
      : `Divergência na conferência de material — O.S. ${numeroOs} (${categoria})`;

  const linhasDivergentes = divergentes
    .map((i) => `<li>Item: ${i.observacao ?? "sem observação"} (qtd. recebida: ${i.quantidade_recebida ?? "?"})</li>`)
    .join("");

  const html = `
    <p>A conferência física de material da <b>O.S. ${numeroOs}</b> foi concluída.</p>
    <p><b>Categoria:</b> ${categoria}<br/><b>Descrição:</b> ${descricao}<br/><b>Resultado:</b> ${resultado === "ok" ? "Tudo certo" : "Divergência encontrada"}</p>
    ${divergentes.length > 0 ? `<p><b>Itens com divergência:</b></p><ul>${linhasDivergentes}</ul>` : ""}
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Sartori O.S. <notificacoes@flowguedes.com.br>",
      to: destinatarios,
      subject: assunto,
      html,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Resend API ${res.status}: ${t.slice(0, 300)}`);
  }
}
