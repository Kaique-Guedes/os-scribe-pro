import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  format,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { OS_STATUS_CLASS, formatBRL, type OsStatus } from "@/lib/os-utils";

export type TipoDataCalendario = "prevista" | "real";

// Formato mínimo de O.S. que o calendário precisa — a rota que usa esse
// componente já busca campos extras (valor, gestor etc.), mas aqui só
// pedimos o que realmente é desenhado na célula do dia.
export interface OrdemCalendario {
  id: string;
  numero_os: string | null;
  status: OsStatus;
  data_entrega_prev: string | null;
  data_entrega_real: string | null;
  clientes: { nome: string } | null;
}

// Uma linha de "Planejamento de Entregas" cadastrada dentro da O.S. — o
// mesmo dado que já alimenta o card Previsto×Realizado do dashboard.
export interface EntregaPlanejadaCalendario {
  os_id: string;
  data_planejada: string;
  valor_planejado: number;
}

// Uma nota fiscal emitida — é o evento que representa uma entrega/faturamento
// REALMENTE acontecido (pode ser parcial, uma O.S. tem várias).
export interface NotaFiscalCalendario {
  os_id: string;
  data_emissao: string;
  valor: number;
}

interface OrdensCalendarioProps {
  rows: OrdemCalendario[];
  tipoData: TipoDataCalendario;
  onTipoDataChange: (v: TipoDataCalendario) => void;
  entregasPlanejadas: EntregaPlanejadaCalendario[];
  notasFiscais: NotaFiscalCalendario[];
}

// Um evento de calendário é sempre "uma O.S., num dia, com um valor" — pode
// vir de 3 lugares diferentes dependendo do tipo:
// - "prevista": uma linha de planejamento (data_planejada) se existir; senão
//   cai pra data_entrega_prev da O.S. inteira (comportamento antigo).
// - "real": uma nota fiscal (data_emissao) se existir alguma; senão cai pra
//   data_entrega_real da O.S. inteira.
// Isso é o mesmo raciocínio de "previsto fatiado por mês" já usado no
// dashboard — aqui só desenhamos no calendário em vez de somar num card.
interface EventoCalendario {
  key: string;
  osId: string;
  numero_os: string | null;
  clienteNome: string | null;
  status: OsStatus;
  data: string; // "yyyy-MM-dd"
  valor: number | null;
}

function agruparPorDia(
  rows: OrdemCalendario[],
  tipoData: TipoDataCalendario,
  entregasPlanejadas: EntregaPlanejadaCalendario[],
  notasFiscais: NotaFiscalCalendario[],
) {
  const eventos: EventoCalendario[] = [];
  const rowsPorId = new Map(rows.map((r) => [r.id, r]));

  if (tipoData === "prevista") {
    const osComPlanejamento = new Set(entregasPlanejadas.map((p) => p.os_id));
    entregasPlanejadas.forEach((p, idx) => {
      const r = rowsPorId.get(p.os_id);
      if (!r || !p.data_planejada) return;
      eventos.push({
        key: `plan-${p.os_id}-${idx}`,
        osId: r.id,
        numero_os: r.numero_os,
        clienteNome: r.clientes?.nome ?? null,
        status: r.status,
        data: p.data_planejada.slice(0, 10),
        valor: Number(p.valor_planejado || 0),
      });
    });
    // Fallback: O.S. sem nenhuma linha de planejamento cadastrada continua
    // aparecendo pela data de entrega prevista da O.S. inteira.
    rows.forEach((r) => {
      if (osComPlanejamento.has(r.id) || !r.data_entrega_prev) return;
      eventos.push({
        key: `plan-fallback-${r.id}`,
        osId: r.id,
        numero_os: r.numero_os,
        clienteNome: r.clientes?.nome ?? null,
        status: r.status,
        data: r.data_entrega_prev.slice(0, 10),
        valor: null,
      });
    });
  } else {
    const osComNota = new Set(notasFiscais.map((n) => n.os_id));
    notasFiscais.forEach((n, idx) => {
      const r = rowsPorId.get(n.os_id);
      if (!r || !n.data_emissao) return;
      eventos.push({
        key: `nf-${n.os_id}-${idx}`,
        osId: r.id,
        numero_os: r.numero_os,
        clienteNome: r.clientes?.nome ?? null,
        status: r.status,
        data: n.data_emissao.slice(0, 10),
        valor: Number(n.valor || 0),
      });
    });
    // Fallback: O.S. sem nenhuma nota fiscal emitida continua aparecendo pela
    // data de entrega real da O.S. inteira (ex: entrega sem faturamento ainda).
    rows.forEach((r) => {
      if (osComNota.has(r.id) || !r.data_entrega_real) return;
      eventos.push({
        key: `real-fallback-${r.id}`,
        osId: r.id,
        numero_os: r.numero_os,
        clienteNome: r.clientes?.nome ?? null,
        status: r.status,
        data: r.data_entrega_real.slice(0, 10),
        valor: null,
      });
    });
  }

  const map = new Map<string, EventoCalendario[]>();
  for (const evento of eventos) {
    if (!map.has(evento.data)) map.set(evento.data, []);
    map.get(evento.data)!.push(evento);
  }
  return map;
}

export function OrdensCalendario({
  rows,
  tipoData,
  onTipoDataChange,
  entregasPlanejadas,
  notasFiscais,
}: OrdensCalendarioProps) {
  const [mesAtual, setMesAtual] = useState(() => startOfMonth(new Date()));

  const porDia = useMemo(
    () => agruparPorDia(rows, tipoData, entregasPlanejadas, notasFiscais),
    [rows, tipoData, entregasPlanejadas, notasFiscais],
  );

  // O grid sempre mostra semanas completas (dom-sáb), por isso o início/fim
  // do grid podem "vazar" um pouco pro mês anterior/seguinte.
  const dias = useMemo(() => {
    const inicioGrid = startOfWeek(startOfMonth(mesAtual), { weekStartsOn: 0 });
    const fimGrid = endOfWeek(endOfMonth(mesAtual), { weekStartsOn: 0 });
    return eachDayOfInterval({ start: inicioGrid, end: fimGrid });
  }, [mesAtual]);

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMesAtual(m => subMonths(m, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium capitalize min-w-[160px] text-center">
            {format(mesAtual, "MMMM 'de' yyyy", { locale: ptBR })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setMesAtual(m => addMonths(m, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMesAtual(startOfMonth(new Date()))}>
            Hoje
          </Button>
        </div>

        <Select value={tipoData} onValueChange={(v) => onTipoDataChange(v as TipoDataCalendario)}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="prevista">Entrega prevista</SelectItem>
            <SelectItem value="real">Entrega real</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden text-sm">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => (
          <div key={d} className="bg-muted text-muted-foreground text-xs font-medium p-2 text-center">
            {d}
          </div>
        ))}

        {dias.map(dia => {
          const chave = format(dia, "yyyy-MM-dd");
          const ordensNoDia = porDia.get(chave) ?? [];
          const foraDoMes = !isSameMonth(dia, mesAtual);

          return (
            <div
              key={chave}
              className={`bg-background min-h-[110px] p-1.5 space-y-1 ${foraDoMes ? "opacity-40" : ""}`}
            >
              <span
                className={`text-xs inline-flex items-center justify-center h-5 w-5 rounded-full ${
                  isToday(dia) ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground"
                }`}
              >
                {format(dia, "d")}
              </span>

              <div className="space-y-1">
                {ordensNoDia.slice(0, 3).map(evento => (
                  <Link key={evento.key} to="/ordens/$id" params={{ id: evento.osId }}>
                    <Badge
                      variant="outline"
                      className={`block w-full truncate text-[11px] font-normal ${OS_STATUS_CLASS[evento.status]}`}
                      title={`${evento.numero_os ?? ""} — ${evento.clienteNome ?? ""}${evento.valor ? ` — ${formatBRL(evento.valor)}` : ""}`}
                    >
                      {evento.numero_os} · {evento.clienteNome ?? "—"}
                      {evento.valor ? ` · ${formatBRL(evento.valor)}` : ""}
                    </Badge>
                  </Link>
                ))}
                {ordensNoDia.length > 3 && (
                  <span className="text-[11px] text-muted-foreground pl-1">
                    +{ordensNoDia.length - 3} mais
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
