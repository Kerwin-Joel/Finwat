import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { supabase } from "../lib/supabase";
import useAuthStore from "../stores/authStore";
import { useToast } from "../hooks/use-toast";

const CATEGORIES = [
  { key: "ALIMENTACION", label: "Alimentación", icon: "🍔" },
  { key: "TRANSPORTE", label: "Transporte", icon: "🚗" },
  { key: "SALUD", label: "Salud", icon: "💊" },
  { key: "ENTRETENIMIENTO", label: "Entretenimiento", icon: "🎬" },
  { key: "EDUCACION", label: "Educación", icon: "📚" },
  { key: "VIVIENDA", label: "Vivienda", icon: "🏠" },
  { key: "SERVICIOS", label: "Servicios", icon: "⚡" },
  { key: "OTROS", label: "Otros", icon: "📌" },
];

interface BudgetEditorProps {
  isOpen: boolean;
  onClose: () => void;
  budgets: Record<string, number>;
  onSave: (budgets: Record<string, number>) => void;
}

const BudgetEditor: React.FC<BudgetEditorProps> = ({
  isOpen,
  onClose,
  budgets,
  onSave,
}) => {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(
      CATEGORIES.map((c) => [c.key, budgets[c.key]?.toString() ?? ""]),
    ),
  );
  // Agrega este useEffect después del useState de values
  useEffect(() => {
    setValues(
      Object.fromEntries(
        CATEGORIES.map((c) => [c.key, budgets[c.key]?.toString() ?? ""]),
      ),
    );
  }, [budgets]);
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuthStore();
  const { toast } = useToast();

  const handleSave = async () => {
    setIsSaving(true);
    const parsed = Object.fromEntries(
      Object.entries(values)
        .filter(([, v]) => v !== "" && parseFloat(v) > 0)
        .map(([k, v]) => [k, parseFloat(v)]),
    );
    console.log("Saving budgets:", JSON.stringify(parsed));
    await supabase
      .from("profiles")
      .update({ category_budgets: parsed })
      .eq("id", user!.id);
    try {
      await supabase
        .from("profiles")
        .update({ category_budgets: parsed })
        .eq("id", user!.id);
      onSave(parsed);
      toast({ title: "Presupuestos guardados" });
      onClose();
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Presupuesto mensual por categoría</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2 max-h-[60vh] overflow-y-auto">
          {CATEGORIES.map((cat) => (
            <div key={cat.key} className="flex items-center gap-3">
              <span className="text-lg w-7">{cat.icon}</span>
              <span className="text-sm flex-1">{cat.label}</span>
              <div className="relative w-28">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  S/.
                </span>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={values[cat.key]}
                  onChange={(e) =>
                    setValues((prev) => ({
                      ...prev,
                      [cat.key]: e.target.value,
                    }))
                  }
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>
          ))}
        </div>
        <Button
          onClick={handleSave}
          className="w-full mt-2"
          disabled={isSaving}
        >
          {isSaving ? "Guardando..." : "Guardar presupuestos"}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default BudgetEditor;
