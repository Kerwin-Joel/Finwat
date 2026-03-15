import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";
import { Progress } from "../components/ui/progress";
import { useToast } from "../hooks/use-toast";
import useAuthStore from "../stores/authStore";
import { loanService } from "../api/loanService";
import type { Loan } from "../types/loan";
import { LOAN_TYPE_CONFIG } from "../types/loan";
import AddLoanModal from "../components/AddLoanModal";
import LoanDetailModal from "../components/LoanDetailModal";

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

const formatCurrency = (n: number) => `S/. ${n.toFixed(2)}`;

const Loans = () => {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);

  const fetchLoans = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      await loanService.updateOverdueStatus(user.id);
      const data = await loanService.getAll(user.id);
      setLoans(data);
    } catch {
      toast({ title: "Error al cargar préstamos", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans();
  }, [user?.id]);

  const summary = useMemo(() => {
    const active = loans.filter(
      (l) => l.status === "active" || l.status === "overdue",
    );
    const totalGiven = active
      .filter((l) => l.direction === "given")
      .reduce((s, l) => s + l.balance_remaining, 0);
    const totalReceived = active
      .filter((l) => l.direction === "received")
      .reduce((s, l) => s + l.balance_remaining, 0);
    const overdue = loans.filter((l) => l.status === "overdue").length;
    return { totalGiven, totalReceived, overdue };
  }, [loans]);

  const active = useMemo(
    () => loans.filter((l) => l.status === "active" || l.status === "overdue"),
    [loans],
  );
  const paid = useMemo(() => loans.filter((l) => l.status === "paid"), [loans]);

  const LoanCard = ({ loan }: { loan: Loan }) => {
    const typeConf = LOAN_TYPE_CONFIG[loan.type];
    const progress =
      loan.principal > 0
        ? ((loan.principal - loan.balance_remaining) / loan.principal) * 100
        : 100;

    return (
      <motion.div variants={fadeUp}>
        <Card
          className={`border-border/50 bg-card/60 cursor-pointer hover:bg-card/80 transition-colors ${loan.status === "overdue" ? "border-red-500/30" : ""}`}
          onClick={() => setSelectedLoan(loan)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                  style={{ backgroundColor: `${typeConf.color}20` }}
                >
                  {typeConf.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold">{loan.entity_name}</p>
                    <Badge
                      variant="secondary"
                      className="text-[9px] px-1.5 py-0"
                    >
                      {typeConf.label}
                    </Badge>
                    {loan.status === "overdue" && (
                      <Badge
                        variant="destructive"
                        className="text-[9px] px-1.5 py-0"
                      >
                        Vencido
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`text-xs font-medium ${loan.direction === "given" ? "text-green-500" : "text-red-400"}`}
                    >
                      {loan.direction === "given" ? "↑ Prestado" : "↓ Recibido"}
                    </span>
                    {loan.due_date && (
                      <span className="text-xs text-muted-foreground">
                        · Vence{" "}
                        {format(parseISO(loan.due_date), "d MMM yyyy", {
                          locale: es,
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p
                  className={`text-sm font-bold ${loan.direction === "given" ? "text-green-500" : "text-red-400"}`}
                >
                  {formatCurrency(loan.balance_remaining)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  de {formatCurrency(loan.principal)}
                </p>
              </div>
            </div>

            {/* Progreso */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>
                  {loan.installments_paid}/{loan.installments_total} cuotas
                </span>
                <span>{progress.toFixed(0)}% pagado</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>

            {/* Interés */}
            {loan.interest_rate > 0 && (
              <p className="text-[10px] text-muted-foreground mt-2">
                💹 {loan.interest_rate}%{" "}
                {loan.interest_period === "monthly"
                  ? "mensual"
                  : loan.interest_period}
                {loan.installment_amount &&
                  ` · Cuota: ${formatCurrency(loan.installment_amount)}`}
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="space-y-4 pt-2 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Préstamos</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona tus préstamos
          </p>
        </div>
        <Button size="sm" className="gap-1" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> Nuevo
        </Button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border/50 bg-card/60">
          <CardContent className="p-3 text-center">
            <TrendingUp size={16} className="mx-auto mb-1 text-green-500" />
            <p className="text-sm font-bold text-green-500">
              {formatCurrency(summary.totalGiven)}
            </p>
            <p className="text-[10px] text-muted-foreground">Te deben</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/60">
          <CardContent className="p-3 text-center">
            <TrendingDown size={16} className="mx-auto mb-1 text-red-400" />
            <p className="text-sm font-bold text-red-400">
              {formatCurrency(summary.totalReceived)}
            </p>
            <p className="text-[10px] text-muted-foreground">Debes</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/60">
          <CardContent className="p-3 text-center">
            <AlertCircle size={16} className="mx-auto mb-1 text-yellow-400" />
            <p className="text-sm font-bold text-yellow-400">
              {summary.overdue}
            </p>
            <p className="text-[10px] text-muted-foreground">Vencidos</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="active">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="active">Activos ({active.length})</TabsTrigger>
          <TabsTrigger value="paid">Pagados ({paid.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {loading ? (
            <p className="text-center text-muted-foreground text-sm py-8">
              Cargando...
            </p>
          ) : active.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <DollarSign
                size={40}
                className="mx-auto text-muted-foreground/30"
              />
              <p className="text-muted-foreground text-sm">
                No tienes préstamos activos
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAdd(true)}
              >
                <Plus size={13} className="mr-1" /> Agregar préstamo
              </Button>
            </div>
          ) : (
            <motion.div
              className="space-y-3"
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.06 } } }}
            >
              {/* Vencidos primero */}
              {active.filter((l) => l.status === "overdue").length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-400 mb-2">
                    ⚠️ Vencidos
                  </p>
                  {active
                    .filter((l) => l.status === "overdue")
                    .map((l) => (
                      <LoanCard key={l.id} loan={l} />
                    ))}
                </div>
              )}
              {active.filter((l) => l.status === "active").length > 0 && (
                <div>
                  {active.filter((l) => l.status === "overdue").length > 0 && (
                    <p className="text-xs font-semibold text-muted-foreground mb-2 mt-4">
                      Al día
                    </p>
                  )}
                  {active
                    .filter((l) => l.status === "active")
                    .map((l) => (
                      <LoanCard key={l.id} loan={l} />
                    ))}
                </div>
              )}
            </motion.div>
          )}
        </TabsContent>

        <TabsContent value="paid" className="mt-4">
          {paid.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign
                size={40}
                className="mx-auto text-muted-foreground/30"
              />
              <p className="text-muted-foreground text-sm mt-2">
                No hay préstamos pagados
              </p>
            </div>
          ) : (
            <motion.div
              className="space-y-3"
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.06 } } }}
            >
              {paid.map((l) => (
                <LoanCard key={l.id} loan={l} />
              ))}
            </motion.div>
          )}
        </TabsContent>
      </Tabs>

      <AddLoanModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={(loan) => {
          setLoans((prev) => [loan, ...prev]);
          setShowAdd(false);
        }}
      />

      {selectedLoan && (
        <LoanDetailModal
          isOpen={!!selectedLoan}
          loan={selectedLoan}
          onClose={() => setSelectedLoan(null)}
          onUpdated={(updated) => {
            setLoans((prev) =>
              prev.map((l) => (l.id === updated.id ? updated : l)),
            );
            setSelectedLoan(updated);
          }}
          onDeleted={(id) => {
            setLoans((prev) => prev.filter((l) => l.id !== id));
            setSelectedLoan(null);
          }}
        />
      )}
    </div>
  );
};

export default Loans;
