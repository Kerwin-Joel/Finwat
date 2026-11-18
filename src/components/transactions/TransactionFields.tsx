import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AmountInput, Field } from "@/components/investments/fields";
import TypeToggle from "@/components/transactions/TypeToggle";
import useAccountStore from "@/stores/accountStore";
import useCategoryStore from "@/stores/categoryStore";
import type { TransactionCategory } from "@/types/transaction";
import { draftErrors, type TransactionDraft } from "@/utils/transactionDraft";

// Campos de un movimiento con el mismo estilo que los formularios de Inversiones:
// etiquetas pequeñas, campos de 44 px, monto con "S/" y errores en línea.

const TransactionFields = ({
  idPrefix,
  draft,
  onChange,
  touched,
  autoFocus,
}: {
  idPrefix: string;
  draft: TransactionDraft;
  onChange: (patch: Partial<TransactionDraft>) => void;
  touched: boolean;
  autoFocus?: boolean;
}) => {
  const { accounts } = useAccountStore();
  const { categories } = useCategoryStore();
  const errors = draftErrors(draft, touched);

  return (
    <div className="space-y-4">
      <TypeToggle id={`${idPrefix}-type`} value={draft.type} onChange={(type) => onChange({ type })} />

      <Field id={`${idPrefix}-amount`} label="Monto" error={errors.amount}>
        <AmountInput
          id={`${idPrefix}-amount`}
          value={draft.amount}
          onChange={(amount) => onChange({ amount })}
          invalid={!!errors.amount}
          autoFocus={autoFocus}
        />
      </Field>

      <Field id={`${idPrefix}-desc`} label="Descripción" error={errors.description}>
        <Input
          id={`${idPrefix}-desc`}
          className="h-11"
          placeholder={draft.type === "expense" ? "¿A dónde se fue tu platita?" : "¿De dónde cayó este billuyo?"}
          value={draft.description}
          onChange={(e) => onChange({ description: e.target.value })}
          aria-invalid={!!errors.description || undefined}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field id={`${idPrefix}-cat`} label="Categoría">
          <Select value={draft.category} onValueChange={(v) => onChange({ category: v as TransactionCategory })}>
            <SelectTrigger id={`${idPrefix}-cat`} className="h-11 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(categories).map(([key, { label, icon, type }]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center">
                    {type === "image" ? (
                      <img src={icon} alt="" className="mr-2 h-5 w-5 rounded-full object-cover" />
                    ) : (
                      <span className="mr-2">{icon}</span>
                    )}
                    {label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field id={`${idPrefix}-acc`} label="Cuenta" error={errors.accountId}>
          <Select value={draft.accountId} onValueChange={(accountId) => onChange({ accountId })}>
            <SelectTrigger id={`${idPrefix}-acc`} className="h-11 rounded-xl">
              <SelectValue placeholder="Elegir" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.name}
                  {acc.last4 ? ` •••• ${acc.last4}` : ""}
                  {acc.is_default ? " · principal" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field id={`${idPrefix}-date`} label="Fecha" error={errors.date}>
        <Input
          id={`${idPrefix}-date`}
          type="date"
          className="h-11"
          value={draft.date}
          onChange={(e) => onChange({ date: e.target.value })}
        />
      </Field>
    </div>
  );
};

export default TransactionFields;
