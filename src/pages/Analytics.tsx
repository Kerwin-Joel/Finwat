import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Calendar,
  Flame,
  Lightbulb,
  Target,
  ArrowUp,
  ArrowDown,
  Repeat,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import useTransactionStore from "../stores/transactionStore";
import {
  format,
  subDays,
  subMonths,
  startOfWeek,
  startOfMonth,
  isAfter,
  parseISO,
} from "date-fns";
import { es } from "date-fns/locale";
import type { Transaction } from "../types/transaction";

type Period = "today" | "week" | "biweekly" | "month" | "3months";

const CATEGORY_LABELS: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  ALIMENTACION: { label: "Alimentación", icon: "🍔", color: "#f97316" },
  TRANSPORTE: { label: "Transporte", icon: "🚗", color: "#3b82f6" },
  SALUD: { label: "Salud", icon: "💊", color: "#ec4899" },
  TRABAJO: { label: "Trabajo", icon: "💼", color: "#22c55e" },
  NEGOCIO: { label: "Negocio", icon: "📦", color: "#a855f7" },
  ENTRETENIMIENTO: { label: "Entretenimiento", icon: "🎬", color: "#eab308" },
  EDUCACION: { label: "Educación", icon: "📚", color: "#06b6d4" },
  VIVIENDA: { label: "Vivienda", icon: "🏠", color: "#84cc16" },
  SERVICIOS: { label: "Servicios", icon: "⚡", color: "#f43f5e" },
  OTROS: { label: "Otros", icon: "📌", color: "#94a3b8" },
};

const formatCurrency = (n: number) =>
  `S/. ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getPeriodRange = (period: Period): { start: Date; end: Date } => {
  const now = new Date();
  switch (period) {
    case "today":
      return { start: new Date(new Date().setHours(0, 0, 0, 0)), end: now };
    case "week":
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: now };
    case "biweekly":
      return { start: subDays(now, 14), end: now };
    case "month":
      return { start: startOfMonth(now), end: now };
    case "3months":
      return { start: subMonths(now, 3), end: now };
  }
};

const filterByRange = (txs: Transaction[], start: Date, end: Date) =>
  txs.filter((t) => {
    const d = parseISO(t.transaction_date);
    return isAfter(d, start) && !isAfter(d, end);
  });

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-xl text-xs">
      <p className="font-semibold mb-1 text-foreground">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

export default function Analytics() {
  const { transactions, fetchTransactions } = useTransactionStore();
  const [period, setPeriod] = useState<Period>("month");
  const savingsGoal = 500;

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const { start, end } = useMemo(() => getPeriodRange(period), [period]);

  const { prevStart, prevEnd } = useMemo(
    () => ({
      prevStart: new Date(start.getTime() - (end.getTime() - start.getTime())),
      prevEnd: start,
    }),
    [start, end],
  );

  const filtered = useMemo(
    () => filterByRange(transactions, start, end),
    [transactions, start, end],
  );

  const prevFiltered = useMemo(
    () => filterByRange(transactions, prevStart, prevEnd),
    [transactions, prevStart, prevEnd],
  );

  const totalIncome = useMemo(
    () =>
      filtered
        .filter((t) => t.type === "income")
        .reduce((s, t) => s + t.amount, 0),
    [filtered],
  );
  const totalExpenses = useMemo(
    () =>
      filtered
        .filter((t) => t.type === "expense")
        .reduce((s, t) => s + t.amount, 0),
    [filtered],
  );
  const netBalance = totalIncome - totalExpenses;
  const avgDailyExp =
    totalExpenses /
    Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));

  const prevIncome = useMemo(
    () =>
      prevFiltered
        .filter((t) => t.type === "income")
        .reduce((s, t) => s + t.amount, 0),
    [prevFiltered],
  );
  const prevExpenses = useMemo(
    () =>
      prevFiltered
        .filter((t) => t.type === "expense")
        .reduce((s, t) => s + t.amount, 0),
    [prevFiltered],
  );

  const incomeChange =
    prevIncome > 0 ? ((totalIncome - prevIncome) / prevIncome) * 100 : 0;
  const expenseChange =
    prevExpenses > 0
      ? ((totalExpenses - prevExpenses) / prevExpenses) * 100
      : 0;

  const mostExpensiveDay = useMemo(() => {
    const byDay = filtered
      .filter((t) => t.type === "expense")
      .reduce((acc: Record<string, number>, t) => {
        acc[t.transaction_date] = (acc[t.transaction_date] || 0) + t.amount;
        return acc;
      }, {});
    return Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
  }, [filtered]);

  const { topCategories, pieData } = useMemo(() => {
    const byCategory = filtered
      .filter((t) => t.type === "expense")
      .reduce((acc: Record<string, number>, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {});
    const top = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    return {
      topCategories: top,
      pieData: top.map(([cat, val]) => ({
        name: CATEGORY_LABELS[cat]?.label ?? cat,
        value: val,
        color: CATEGORY_LABELS[cat]?.color ?? "#94a3b8",
        icon: CATEGORY_LABELS[cat]?.icon ?? "📌",
      })),
    };
  }, [filtered]);

  const frequentTxs = useMemo(() => {
    const freqMap = filtered.reduce(
      (
        acc: Record<string, { count: number; total: number; type: string }>,
        t,
      ) => {
        const key = t.description?.toLowerCase() ?? "";
        if (!acc[key]) acc[key] = { count: 0, total: 0, type: t.type };
        acc[key].count++;
        acc[key].total += t.amount;
        return acc;
      },
      {},
    );
    return Object.entries(freqMap)
      .filter(([, v]) => v.count > 1)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 4);
  }, [filtered]);

  const barData = useMemo(() => {
    if (period === "today") {
      const byHour = filtered.reduce(
        (acc: Record<string, { income: number; expense: number }>, t) => {
          const h = `${new Date(t.transaction_date).getHours()}h`;
          if (!acc[h]) acc[h] = { income: 0, expense: 0 };
          if (t.type === "income") acc[h].income += t.amount;
          else acc[h].expense += t.amount;
          return acc;
        },
        {},
      );
      return Object.entries(byHour).map(([h, v]) => ({ name: h, ...v }));
    }
    const byDay = filtered.reduce(
      (acc: Record<string, { income: number; expense: number }>, t) => {
        const d = format(
          parseISO(t.transaction_date),
          period === "3months" ? "MMM" : "dd MMM",
          { locale: es },
        );
        if (!acc[d]) acc[d] = { income: 0, expense: 0 };
        if (t.type === "income") acc[d].income += t.amount;
        else acc[d].expense += t.amount;
        return acc;
      },
      {},
    );
    return Object.entries(byDay).map(([d, v]) => ({ name: d, ...v }));
  }, [filtered, period]);

  const lineData = useMemo(() => {
    const sorted = [...filtered].sort(
      (a, b) =>
        new Date(a.transaction_date).getTime() -
        new Date(b.transaction_date).getTime(),
    );
    type LinePoint = { name: string; balance: number; _acc: number };
    return sorted.reduce<LinePoint[]>((acc, t) => {
      const prev = acc[acc.length - 1]?._acc ?? 0;
      const next = parseFloat(
        (prev + (t.type === "income" ? t.amount : -t.amount)).toFixed(2),
      );
      return [
        ...acc,
        {
          name: format(parseISO(t.transaction_date), "dd MMM", { locale: es }),
          balance: next,
          _acc: next,
        },
      ];
    }, []);
  }, [filtered]);

  const projectedExpenses = useMemo(() => {
    if (period !== "month") return null;
    const dayOfMonth = new Date().getDate();
    const daysInMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      0,
    ).getDate();
    return dayOfMonth > 0 ? (totalExpenses / dayOfMonth) * daysInMonth : null;
  }, [period, totalExpenses]);

  const insight = useMemo(() => {
    const topCat = topCategories[0];
    if (!topCat || totalExpenses === 0)
      return "Registra más movimientos para obtener insights personalizados.";
    const pct = ((topCat[1] / totalExpenses) * 100).toFixed(0);
    return `Estás gastando el ${pct}% de tu presupuesto en ${CATEGORY_LABELS[topCat[0]]?.label ?? topCat[0]}. ${
      Number(pct) > 40
        ? "Considera reducir este gasto."
        : "¡Buen control de gastos!"
    }`;
  }, [topCategories, totalExpenses]);

  const savingsPct = Math.min(100, (netBalance / savingsGoal) * 100);

  const PERIODS = [
    { value: "today", label: "Hoy" },
    { value: "week", label: "Semana" },
    { value: "biweekly", label: "Quincena" },
    { value: "month", label: "Mes" },
    { value: "3months", label: "3 Meses" },
  ];

  const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.07 } },
  };
  const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="space-y-5 pt-2 pb-24">
      <div>
        <h1 className="text-2xl font-bold">Análisis</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Tu salud financiera de un vistazo
        </p>
      </div>

      <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
        <TabsList className="w-full justify-start h-9 bg-transparent p-0 gap-2 overflow-x-auto flex-nowrap">
          {PERIODS.map((p) => (
            <TabsTrigger
              key={p.value}
              value={p.value}
              className="rounded-full border border-border data-[state=active]:bg-primary data-[state=active]:text-primary-foreground whitespace-nowrap text-xs px-3"
            >
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="space-y-4"
      >
        {/* Tarjetas resumen */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: "Ingresos",
              value: totalIncome,
              icon: <ArrowUp size={14} />,
              color: "text-green-500",
              bg: "bg-green-500/10",
              change: incomeChange,
              positive: true,
            },
            {
              label: "Gastos",
              value: totalExpenses,
              icon: <ArrowDown size={14} />,
              color: "text-red-400",
              bg: "bg-red-500/10",
              change: expenseChange,
              positive: false,
            },
            {
              label: "Balance",
              value: netBalance,
              icon: <Wallet size={14} />,
              color: netBalance >= 0 ? "text-blue-400" : "text-red-400",
              bg: "bg-blue-500/10",
              change: null,
              positive: true,
            },
          ].map((card) => (
            <motion.div key={card.label} variants={fadeUp}>
              <Card className="border-border/50 bg-card/60">
                <CardContent className="p-3">
                  <div
                    className={`${card.bg} ${card.color} w-7 h-7 rounded-full flex items-center justify-center mb-2`}
                  >
                    {card.icon}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {card.label}
                  </p>
                  <p
                    className={`text-sm font-bold ${card.color} leading-tight`}
                  >
                    S/. {Math.abs(card.value).toFixed(0)}
                  </p>
                  {card.change !== null && (
                    <p
                      className={`text-[10px] mt-0.5 ${card.positive ? (card.change >= 0 ? "text-green-500" : "text-red-400") : card.change <= 0 ? "text-green-500" : "text-red-400"}`}
                    >
                      {card.change >= 0 ? "↑" : "↓"}{" "}
                      {Math.abs(card.change).toFixed(0)}% vs anterior
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Insight */}
        <motion.div variants={fadeUp}>
          <Card className="border-yellow-500/20 bg-yellow-500/5">
            <CardContent className="p-4 flex gap-3 items-start">
              <div className="bg-yellow-500/10 p-2 rounded-full mt-0.5">
                <Lightbulb size={16} className="text-yellow-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-yellow-400 mb-1">
                  Insight
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {insight}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Ingresos vs Gastos */}
        <motion.div variants={fadeUp}>
          <Card className="border-border/50 bg-card/60">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">
                Ingresos vs Gastos
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              {barData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={barData} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      width={40}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="income"
                      name="Ingresos"
                      fill="#22c55e"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={24}
                    />
                    <Bar
                      dataKey="expense"
                      name="Gastos"
                      fill="#f43f5e"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={24}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-40 flex items-center justify-center text-muted-foreground text-xs">
                  Sin datos para este período
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Evolución del balance */}
        <motion.div variants={fadeUp}>
          <Card className="border-border/50 bg-card/60">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">
                Evolución del Balance
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              {lineData.length > 1 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      width={40}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="balance"
                      name="Balance"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-36 flex items-center justify-center text-muted-foreground text-xs">
                  Sin suficientes datos
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Distribución por categoría */}
        <motion.div variants={fadeUp}>
          <Card className="border-border/50 bg-card/60">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">
                Distribución de Gastos
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {pieData.length > 0 ? (
                <div className="flex gap-4 items-center">
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={55}
                        dataKey="value"
                        paddingAngle={2}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5">
                    {pieData.map((entry) => (
                      <div
                        key={entry.name}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="text-xs text-muted-foreground">
                            {entry.icon} {entry.name}
                          </span>
                        </div>
                        <span className="text-xs font-semibold">
                          {totalExpenses > 0
                            ? ((entry.value / totalExpenses) * 100).toFixed(0)
                            : 0}
                          %
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-28 flex items-center justify-center text-muted-foreground text-xs">
                  Sin gastos registrados
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Top categorías */}
        <motion.div variants={fadeUp}>
          <Card className="border-border/50 bg-card/60">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Flame size={14} className="text-orange-400" /> Top Categorías
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {topCategories.length > 0 ? (
                topCategories.map(([cat, amount], i) => (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs flex items-center gap-1.5">
                        <span>{CATEGORY_LABELS[cat]?.icon}</span>
                        <span>{CATEGORY_LABELS[cat]?.label ?? cat}</span>
                        {i === 0 && (
                          <Badge
                            variant="secondary"
                            className="text-[9px] px-1 py-0"
                          >
                            Top
                          </Badge>
                        )}
                      </span>
                      <span className="text-xs font-semibold">
                        {formatCurrency(amount)}
                      </span>
                    </div>
                    <Progress
                      value={
                        totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0
                      }
                      className="h-1.5"
                    />
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Sin gastos en este período
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Día más caro + Promedio diario */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div variants={fadeUp}>
            <Card className="border-border/50 bg-card/60 h-full">
              <CardContent className="p-4">
                <div className="bg-red-500/10 w-8 h-8 rounded-full flex items-center justify-center mb-3">
                  <Calendar size={15} className="text-red-400" />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Día más caro
                </p>
                {mostExpensiveDay ? (
                  <>
                    <p className="text-sm font-bold text-red-400 mt-1">
                      {format(parseISO(mostExpensiveDay[0]), "dd MMM", {
                        locale: es,
                      })}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatCurrency(mostExpensiveDay[1])}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    Sin datos
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={fadeUp}>
            <Card className="border-border/50 bg-card/60 h-full">
              <CardContent className="p-4">
                <div className="bg-blue-500/10 w-8 h-8 rounded-full flex items-center justify-center mb-3">
                  <TrendingDown size={15} className="text-blue-400" />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Gasto diario promedio
                </p>
                <p className="text-sm font-bold text-blue-400 mt-1">
                  {formatCurrency(avgDailyExp)}
                </p>
                <p className="text-[10px] text-muted-foreground">por día</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Meta de ahorro */}
        <motion.div variants={fadeUp}>
          <Card className="border-border/50 bg-card/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="bg-green-500/10 p-1.5 rounded-full">
                    <Target size={14} className="text-green-500" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">Meta de Ahorro</p>
                    <p className="text-[10px] text-muted-foreground">
                      Objetivo: {formatCurrency(savingsGoal)}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-sm font-bold ${netBalance >= savingsGoal ? "text-green-500" : "text-muted-foreground"}`}
                >
                  {savingsPct.toFixed(0)}%
                </span>
              </div>
              <Progress value={Math.max(0, savingsPct)} className="h-2" />
              <p className="text-[10px] text-muted-foreground mt-2">
                {netBalance >= savingsGoal
                  ? "🎉 ¡Meta alcanzada!"
                  : `Faltan ${formatCurrency(savingsGoal - netBalance)} para tu meta`}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Predicción fin de mes */}
        {projectedExpenses !== null && (
          <motion.div variants={fadeUp}>
            <Card className="border-purple-500/20 bg-purple-500/5">
              <CardContent className="p-4 flex gap-3 items-start">
                <div className="bg-purple-500/10 p-2 rounded-full mt-0.5">
                  <TrendingUp size={16} className="text-purple-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-purple-400 mb-1">
                    Predicción fin de mes
                  </p>
                  <p className="text-xs text-muted-foreground">
                    A este ritmo gastarás aproximadamente{" "}
                    <span className="font-semibold text-foreground">
                      {formatCurrency(projectedExpenses)}
                    </span>{" "}
                    este mes.{" "}
                    {projectedExpenses > totalIncome
                      ? "⚠️ Podrías gastar más de lo que ingresas."
                      : "✅ Estás dentro de tu presupuesto."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Transacciones frecuentes */}
        <motion.div variants={fadeUp}>
          <Card className="border-border/50 bg-card/60">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Repeat size={14} className="text-muted-foreground" />{" "}
                Transacciones Frecuentes
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {frequentTxs.length > 0 ? (
                <div className="space-y-2">
                  {frequentTxs.map(([desc, data]) => (
                    <div
                      key={desc}
                      className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">
                          {data.type === "income" ? "💰" : "💸"}
                        </span>
                        <div>
                          <p className="text-xs font-medium capitalize">
                            {desc}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {data.count} veces
                          </p>
                        </div>
                      </div>
                      <p
                        className={`text-xs font-semibold ${data.type === "income" ? "text-green-500" : "text-red-400"}`}
                      >
                        {formatCurrency(data.total)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No hay transacciones repetidas en este período
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
