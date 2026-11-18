import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import BottomSheet from "@/components/investments/BottomSheet";
import TransactionFields from "@/components/transactions/TransactionFields";
import { draftErrors, type TransactionDraft } from "@/utils/transactionDraft";
import { useToast } from "../hooks/use-toast";
import useTransactionStore from "../stores/transactionStore";
import type { Transaction } from "../types/transaction";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { celebrate } from "@/lib/celebrate";
import { formatCurrency } from "@/utils/formatCurrency";

// Editar movimiento: mismo formulario y estilo que "Nuevo movimiento" e Inversiones.
// Guardar se habilita solo si algo cambió; eliminar es una acción discreta con confirmación.

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
}

const fromTransaction = (t: Transaction): TransactionDraft => ({
  type: t.type,
  amount: String(t.amount),
  description: t.description ?? "",
  category: t.category,
  accountId: t.account_id,
  date: t.transaction_date,
});

const EditTransactionModal: React.FC<EditTransactionModalProps> = ({ isOpen, onClose, transaction }) => {
  const { updateTransaction, deleteTransaction } = useTransactionStore();
  const { toast } = useToast();

  const [draft, setDraft] = useState<TransactionDraft | null>(transaction ? fromTransaction(transaction) : null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (transaction) setDraft(fromTransaction(transaction));
  }, [transaction]);

  if (!transaction || !draft) return null;

  const amountNumber = Number(draft.amount.replace(",", "."));
  const valid = !Object.values(draftErrors(draft, true)).some(Boolean);
  const dirty =
    draft.type !== transaction.type ||
    amountNumber !== Number(transaction.amount) ||
    draft.description !== (transaction.description ?? "") ||
    draft.category !== transaction.category ||
    draft.accountId !== transaction.account_id ||
    draft.date !== transaction.transaction_date;

  const submit = async () => {
    if (!valid || !dirty || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await updateTransaction(transaction.id, {
        type: draft.type,
        amount: amountNumber,
        description: draft.description.trim(),
        category: draft.category,
        account_id: draft.accountId,
        transaction_date: draft.date,
      });
      await celebrate();
      toast({ title: "Movimiento actualizado", description: "Los cambios se guardaron." });
      onClose();
    } catch (error) {
      console.error(error);
      toast({ title: "No se actualizó el movimiento", description: "Revisa tu conexión e inténtalo de nuevo.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteTransaction(transaction.id);
      toast({ title: "Movimiento eliminado" });
      onClose();
    } catch (error) {
      console.error(error);
      toast({ title: "No se eliminó el movimiento", description: "Revisa tu conexión e inténtalo de nuevo.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <BottomSheet
      open={isOpen}
      onOpenChange={(o) => !o && onClose()}
      title="Editar movimiento"
      footer={
        <div className="flex flex-col gap-1.5">
          <ConfirmButton
            className="h-11 w-full"
            onClick={submit}
            disabled={!dirty || !valid}
            loading={isSubmitting}
            loadingText="Guardando…"
          >
            {dirty ? "Guardar cambios" : "Sin cambios"}
          </ConfirmButton>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="w-full gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={isDeleting || isSubmitting}
              >
                <Trash2 className="h-4 w-4" />
                Eliminar movimiento
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-[360px] rounded-3xl">
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar este movimiento?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminará «{transaction.description || "sin descripción"}» por {formatCurrency(Number(transaction.amount))}.
                  Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2 sm:gap-2">
                <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
                <ConfirmButton variant="destructive" onClick={handleDelete} loading={isDeleting} loadingText="Eliminando…">
                  Eliminar
                </ConfirmButton>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <TransactionFields
          idPrefix="edit-tx"
          draft={draft}
          onChange={(patch) => setDraft((d) => (d ? { ...d, ...patch } : d))}
          touched
        />
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </BottomSheet>
  );
};

export default EditTransactionModal;
