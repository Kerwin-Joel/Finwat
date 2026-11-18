import { useState } from "react";
import { Archive, Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import useAccountStore from "@/stores/accountStore";
import BottomSheet from "@/components/investments/BottomSheet";
import { AmountInput, Chips, Field } from "@/components/investments/fields";
import AccountCard from "@/components/AccountCard";
import { cn } from "@/lib/utils";
import { parseAmountToCents } from "@/utils/money";
import type { Account, AccountType, CardKind, CardNetworkId, CardStyle } from "@/types/account";
import { CARD_STYLES, toNumber } from "@/types/account";
import { CARD_STYLE_CLASS } from "./cardStyle";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { celebrate } from "@/lib/celebrate";

const TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: "card", label: "Tarjeta" },
  { value: "bank", label: "Cuenta bancaria" },
  { value: "wallet", label: "Billetera digital" },
  { value: "cash", label: "Efectivo" },
];
const KIND_OPTIONS: { value: CardKind; label: string }[] = [
  { value: "debito", label: "Débito" },
  { value: "credito", label: "Crédito" },
];
const NETWORK_OPTIONS: { value: CardNetworkId; label: string }[] = [
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "amex", label: "Amex" },
  { value: "diners", label: "Diners" },
  { value: "otra", label: "Otra" },
];

/** Crear o editar una cuenta/tarjeta. account = null → nueva. */
const AccountSheet = ({
  open,
  onOpenChange,
  account,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  account: Account | null;
}) => {
  const { toast } = useToast();
  const { addAccount, editAccount, archive, makeDefault, accounts } = useAccountStore();
  const editing = !!account;

  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<AccountType>(account?.type ?? "card");
  const [kind, setKind] = useState<CardKind>(account?.card_kind ?? "debito");
  const [network, setNetwork] = useState<CardNetworkId>(account?.card_network ?? "visa");
  const [last4, setLast4] = useState(account?.last4 ?? "");
  const [bank, setBank] = useState(account?.bank_name ?? "");
  const [style, setStyle] = useState<CardStyle>(account?.card_style ?? (accounts.length % 2 ? "medianoche" : "aurora"));
  const [limit, setLimit] = useState(account?.credit_limit ? String(toNumber(account.credit_limit)) : "");
  const [currency, setCurrency] = useState<"PEN" | "USD">((account?.currency as "PEN" | "USD") ?? "PEN");
  const [principal, setPrincipal] = useState(false);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const isCard = type === "card";
  const showBankFields = type === "card" || type === "bank";
  const limitCents = limit.trim() ? parseAmountToCents(limit) : null;

  const errors = {
    name: !name.trim() ? "Ponle un nombre, p. ej. Visa BCP" : null,
    last4: last4 && !/^\d{4}$/.test(last4) ? "Escribe los 4 últimos dígitos" : null,
    limit: limit.trim() && limitCents === null ? "Monto no válido" : null,
  };
  const valid = !Object.values(errors).some(Boolean);

  // Lo que se guarda (y lo que dibuja la vista previa)
  const draft = {
    name: name.trim(),
    type,
    currency,
    card_kind: isCard ? kind : null,
    card_network: isCard ? network : null,
    last4: showBankFields && last4 ? last4 : null,
    bank_name: showBankFields && bank.trim() ? bank.trim() : null,
    card_style: style,
    credit_limit: isCard && kind === "credito" && limitCents !== null ? limitCents / 100 : null,
  };

  const preview: Account = {
    id: account?.id ?? "preview",
    user_id: "",
    balance: account?.balance ?? 0,
    is_default: account?.is_default ?? principal,
    is_active: true,
    created_at: "",
    updated_at: "",
    ...draft,
    name: draft.name || "Nueva cuenta",
  };

  const save = async () => {
    setTouched(true);
    if (!valid || saving) return;
    setSaving(true);
    try {
      if (editing && account) {
        await editAccount(account.id, draft);
        toast({ title: "Cuenta actualizada" });
      } else {
        await addAccount(draft, principal);
        toast({ title: `${draft.name} agregada` });
      }
      await celebrate();
      onOpenChange(false);
    } catch (err) {
      toast({ title: "No se pudo guardar", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const doArchive = async () => {
    if (!account) return;
    setSaving(true);
    try {
      await archive(account.id);
      toast({ title: `${account.name} archivada`, description: "Sus movimientos se conservan." });
      onOpenChange(false);
    } catch (err) {
      toast({ title: "No se pudo archivar", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const doMakeDefault = async () => {
    if (!account) return;
    setSaving(true);
    try {
      await makeDefault(account.id);
      toast({ title: `${account.name} ahora es tu cuenta principal`, description: "Lo que registres por WhatsApp irá aquí." });
    } catch (err) {
      toast({ title: "No se pudo cambiar", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Editar cuenta" : "Nueva cuenta"}
      description={editing ? undefined : "Tarjetas, cuentas bancarias, billeteras o efectivo."}
      footer={
        <ConfirmButton size="lg" className="w-full" onClick={save} loading={saving} loadingText="Guardando…">
          {editing ? "Guardar cambios" : "Crear cuenta"}
        </ConfirmButton>
      }
    >
      <div className="space-y-5">
        {/* Vista previa en vivo */}
        <div className="pointer-events-none select-none" aria-hidden="true">
          <AccountCard account={preview} preview totalBalance={toNumber(preview.balance)} className="md:p-6" />
        </div>

        <Field id="acc-name" label="Nombre" error={touched ? errors.name : null}>
          <Input id="acc-name" className="h-11" placeholder="Visa BCP, Ahorros Interbank…" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <Field id="acc-type" label="Tipo">
          <Chips label="Tipo de cuenta" value={type} onChange={setType} options={TYPE_OPTIONS} />
        </Field>

        {isCard && (
          <>
            <Field id="acc-kind" label="Tarjeta de">
              <Chips label="Débito o crédito" value={kind} onChange={setKind} options={KIND_OPTIONS} />
            </Field>
            <Field id="acc-network" label="Red">
              <Chips label="Red de la tarjeta" value={network} onChange={setNetwork} options={NETWORK_OPTIONS} />
            </Field>
          </>
        )}

        {showBankFields && (
          <div className="grid grid-cols-2 gap-3">
            <Field id="acc-bank" label="Banco (opcional)">
              <Input id="acc-bank" className="h-11" placeholder="BCP" maxLength={30} value={bank} onChange={(e) => setBank(e.target.value)} />
            </Field>
            <Field id="acc-last4" label="Últimos 4 dígitos" error={touched ? errors.last4 : null} hint="Nunca el número completo">
              <Input
                id="acc-last4"
                className="h-11 tracking-[0.2em]"
                inputMode="numeric"
                maxLength={4}
                placeholder="8152"
                value={last4}
                onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
            </Field>
          </div>
        )}

        {isCard && kind === "credito" && (
          <Field id="acc-limit" label="Línea de crédito (opcional)" error={touched ? errors.limit : null} hint="Para mostrarte cuánto te queda disponible">
            <AmountInput id="acc-limit" value={limit} onChange={setLimit} currency={currency} />
          </Field>
        )}

        <Field id="acc-style" label="Diseño">
          <div role="radiogroup" aria-label="Diseño de la tarjeta" className="grid grid-cols-6 gap-2">
            {CARD_STYLES.map((s) => (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={style === s.value}
                aria-label={s.label}
                title={s.label}
                onClick={() => setStyle(s.value)}
                className={cn(
                  CARD_STYLE_CLASS[s.value],
                  "relative aspect-[1.4] w-full overflow-hidden rounded-xl ring-offset-2 ring-offset-background transition-transform duration-200 ease-out-expo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  style === s.value ? "scale-[1.04] ring-2 ring-primary" : "hover:scale-[1.03]",
                )}
              >
                {style === s.value && <Check className="absolute inset-0 m-auto h-4 w-4 text-white" aria-hidden="true" />}
              </button>
            ))}
          </div>
        </Field>

        {!editing && (
          <Field id="acc-currency" label="Moneda">
            <Chips
              label="Moneda"
              value={currency}
              onChange={setCurrency}
              options={[
                { value: "PEN", label: "Soles (S/)" },
                { value: "USD", label: "Dólares (US$)" },
              ]}
            />
          </Field>
        )}

        {!editing && (
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-2xl bg-secondary px-4 py-3">
            <span>
              <span className="block text-[14px] font-medium">Usar como cuenta principal</span>
              <span className="block text-[12px] text-muted-foreground">Lo que registres por WhatsApp irá aquí</span>
            </span>
            <input type="checkbox" className="h-5 w-5 accent-[hsl(var(--primary))]" checked={principal} onChange={(e) => setPrincipal(e.target.checked)} />
          </label>
        )}

        {editing && account && (
          <div className="space-y-2 border-t border-border/60 pt-4">
            {account.is_default ? (
              <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <Star className="h-4 w-4 text-amber-500" aria-hidden="true" /> Es tu cuenta principal: WhatsApp registra aquí.
              </p>
            ) : (
              <>
                <Button variant="outline" className="w-full" onClick={doMakeDefault} disabled={saving}>
                  <Star className="h-4 w-4" /> Hacer cuenta principal
                </Button>
                {confirmArchive ? (
                  <div className="rounded-2xl bg-destructive/10 p-3 text-[13px] text-destructive">
                    <p>Se ocultará de la app. Sus movimientos se conservan y siguen contando en tu historial.</p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="destructive" onClick={doArchive} disabled={saving}>
                        Archivar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmArchive(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setConfirmArchive(true)}>
                    <Archive className="h-4 w-4" /> Archivar cuenta
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  );
};

export default AccountSheet;
