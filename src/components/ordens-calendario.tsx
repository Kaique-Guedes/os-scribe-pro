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
import { OS_STATUS_CLASS, type OsStatus } from "@/lib/os-utils";

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

interface OrdensCalendarioProps {
  rows: OrdemCalendario[];
  tipoData: TipoDataCalendario;
  onTipoDataChange: (v: TipoDataCalendario) => void;
}

// Agrupa as O.S. por dia (chave "yyyy-MM-dd") de acordo com o campo de data
// escolhido no filtro. Um Map aqui é só uma forma eficiente de responder
// "quais O.S. caem no dia X?" sem varrer o array inteiro pra cada célula do grid.
function agruparPorDia(rows: OrdemCalendario[], tipoData: TipoDataCalendario) {
  const campo = tipoData === "prevista" ? "data_entrega_prev" : "data_entrega_real";
  const map = new Map<string, OrdemCalendario[]>();
  for (const r of rows) {
    const data = r[campo];
    if (!data) continue;
    const chave = data.slice(0, 10); // "yyyy-MM-dd"
    if (!map.has(chave)) map.set(chave, []);
    map.get(chave)!.push(r);
  }
  return map;
}

export function OrdensCalendario({ rows, tipoData, onTipoDataChange }: OrdensCalendarioProps) {
  const [mesAtual, setMesAtual] = useState(() => startOfMonth(new Date()));

  const porDia = useMemo(() => agruparPorDia(rows, tipoData), [rows, tipoData]);

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
                {ordensNoDia.slice(0, 3).map(os => (
                  <Link key={os.id} to="/ordens/$id" params={{ id: os.id }}>
                    <Badge
                      variant="outline"
                      className={`block w-full truncate text-[11px] font-normal ${OS_STATUS_CLASS[os.status]}`}
                      title={`${os.numero_os ?? ""} — ${os.clientes?.nome ?? ""}`}
                    >
                      {os.numero_os} · {os.clientes?.nome ?? "—"}
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
