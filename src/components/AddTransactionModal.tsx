import { useState } from "react";
import { format } from "date-fns";
import BottomSheet from "@/components/investments/BottomSheet";
import TransactionFields from "@/components/transactions/TransactionFields";
import { draftErrors, type TransactionDraft } from "@/utils/transactionDraft";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { useToast } from "../hooks/use-toast";
import useTransactionStore from "../stores/transactionStore";
import useAccountStore from "../stores/accountStore";
import { celebrate } from "@/lib/celebrate";
import { formatCurrency } from "@/utils/formatCurrency";

// Nuevo movimiento con el mismo estilo que los formularios de Inversiones (hoja inferior en
// el celular, modal centrado en escritorio). Al guardar: onda en el botón, estallido y la
// fila nueva de la lista recibe su propia onda (highlightId en el store).

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const today = () => format(new Date(), "yyyy-MM-dd");

const AddTransactionModal: React.FC<AddTransactionModalProps> = ({ isOpen, onClose }) => {
  const { addTransaction } = useTransactionStore();
  const { accounts } = useAccountStore();
  const { toast } = useToast();

  const [draft, setDraft] = useState<TransactionDraft>({
    type: "expense",
    amount: "",
    description: "",
    category: "OTROS",
    accountId: "",
    date: today(),
  });
  // Si no eligió ninguna (o las cuentas cargaron después), se usa la principal
  const accountId = draft.accountId || accounts.find((a) => a.is_default)?.id || accounts[0]?.id || "";
  const full: TransactionDraft = { ...draft, accountId };
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const amountNumber = Number(draft.amount.replace(",", "."));
  const valid = !Object.values(draftErrors(full, true)).some(Boolean);

  const reset = () => {
    setDraft((d) => ({ ...d, amount: "", description: "", date: today() }));
    setTouched(false);
  };

  const close = (open: boolean) => {
    if (open) return;
    onClose();
    if (!saving) reset();
  };

  const submit = async () => {
    setTouched(true);
    if (!valid || saving) return;
    setSaving(true);
    try {
      await addTransaction({
        type: draft.type,
        amount: amountNumber,
        description: draft.description.trim(),
        category: draft.category,
        account_id: accountId,
        transaction_date: draft.date,
      });
      await celebrate();
      toast({
        title: "Movimiento registrado",
        description: `${draft.type === "income" ? "Ingreso" : "Gasto"} de ${formatCurrency(amountNumber)} guardado.`,
      });
      onClose();
      reset();
    } catch (error) {
      console.error(error);
      toast({ title: "No se guardó el movimiento", description: "Revisa tu conexión e inténtalo de nuevo.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={isOpen}
      onOpenChange={close}
      title="Nuevo movimiento"
      description="Regístralo aquí o escríbelo por WhatsApp."
      footer={
        <ConfirmButton className="h-11 w-full" onClick={submit} loading={saving} loadingText="Guardando…">
          {Number.isFinite(amountNumber) && amountNumber > 0
            ? `Registrar ${draft.type === "income" ? "ingreso" : "gasto"} de ${formatCurrency(amountNumber)}`
            : "Registrar movimiento"}
        </ConfirmButton>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <TransactionFields
          idPrefix="add-tx"
          draft={full}
          onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          touched={touched}
          autoFocus
        />
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </BottomSheet>
  );
};

export default AddTransactionModal;
