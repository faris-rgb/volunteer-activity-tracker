"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircle, Plus, Trash, Wallet } from "lucide-react";
import { ALLOWANCE_TYPES, type AllowanceType, type Stay } from "@/lib/domain";
import { addAllowancePaymentAction, removeAllowancePaymentAction } from "@/app/actions/stays";
import {
  ALLOWANCE_TYPE_LABELS,
  CURRENCIES,
  allowanceTotals,
  currencyTotals,
  formatMoney,
  shortDate,
  type Currency,
} from "./stayUtils";
import { WarningBox, callAction, inputClassName, type Notice } from "./ui";

interface PaymentForm {
  type: AllowanceType;
  date: string;
  amount: string;
  currency: Currency;
  note: string;
}

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

export default function AllowancesLedger({
  stay,
  today,
  onStayChanged,
  onNotice,
}: {
  stay: Stay;
  today: string;
  onStayChanged: (stay: Stay) => void;
  onNotice: (notice: Notice) => void;
}) {
  const [form, setForm] = useState<PaymentForm>({ type: "pocket_money", date: today, amount: "", currency: "MAD", note: "" });
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [removingKey, setRemovingKey] = useState<string | null>(null);

  const payments = [...(stay.allowances ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const totals = allowanceTotals(stay.allowances);
  const grandTotals = currencyTotals(stay.allowances);

  const update = <K extends keyof PaymentForm>(key: K, value: PaymentForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  // Rendered outside the stay <form> by StayModal, so this can be its own form.
  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (adding) return;
    const amountText = form.amount.trim().replace(",", ".");
    const amount = Number(amountText);
    if (!AMOUNT_PATTERN.test(amountText) || !(amount > 0)) {
      setError("Enter a positive amount with at most 2 decimals.");
      document.getElementById("allowance-amount")?.focus();
      return;
    }
    if (amount > 1_000_000) {
      setError("Amount can be at most 1,000,000.");
      return;
    }
    if (!form.date) {
      setError("Choose the payment date.");
      return;
    }
    setAdding(true);
    const result = await callAction(() =>
      addAllowancePaymentAction(stay._id, {
        type: form.type,
        date: form.date,
        amount,
        currency: form.currency,
        note: form.note.trim() || undefined,
      })
    );
    setAdding(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onStayChanged(result.data);
    setForm((prev) => ({ ...prev, amount: "", note: "" }));
    onNotice({
      type: "success",
      message: `Recorded ${formatMoney(amount, form.currency)} ${ALLOWANCE_TYPE_LABELS[form.type].toLowerCase()}.`,
    });
  };

  const handleRemove = async (key: string) => {
    if (removingKey) return;
    setRemovingKey(key);
    const result = await callAction(() => removeAllowancePaymentAction(stay._id, key));
    setRemovingKey(null);
    setConfirmKey(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onStayChanged(result.data);
    onNotice({ type: "success", message: "Payment removed from the ledger." });
  };

  return (
    <section aria-labelledby="allowances-heading" className="space-y-3">
      <h4 id="allowances-heading" className="flex items-center gap-2 text-sm font-bold text-white">
        <Wallet className="h-4 w-4 text-emerald-400" />
        Allowances ledger
      </h4>

      {totals.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {totals.map((total) => (
            <div key={`${total.type}-${total.currency}`} className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
              <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                {ALLOWANCE_TYPE_LABELS[total.type]}
              </span>
              <span className="block text-sm font-bold text-white">{formatMoney(total.total, total.currency)}</span>
              <span className="block text-[10px] text-slate-500">
                {total.count} payment{total.count === 1 ? "" : "s"}
              </span>
            </div>
          ))}
          {grandTotals.map((total) => (
            <div
              key={`all-${total.currency}`}
              className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2"
            >
              <span className="block text-[10px] uppercase tracking-wider text-emerald-400/80 font-semibold">
                Total {total.currency}
              </span>
              <span className="block text-sm font-bold text-emerald-300">{formatMoney(total.total, total.currency)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-slate-800 overflow-hidden">
        {payments.length === 0 ? (
          <p className="px-4 py-5 text-center text-xs text-slate-500">
            No payments recorded yet. Log pocket money, food and travel reimbursements below.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-950/40 text-slate-500 uppercase tracking-wider">
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold text-right">Amount</th>
                  <th className="px-3 py-2 font-semibold">Note</th>
                  <th className="px-3 py-2">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {payments.map((payment) => (
                  <tr key={payment._key}>
                    <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{shortDate(payment.date)}</td>
                    <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{ALLOWANCE_TYPE_LABELS[payment.type]}</td>
                    <td className="px-3 py-2 text-white font-semibold text-right whitespace-nowrap">
                      {formatMoney(payment.amount, payment.currency)}
                    </td>
                    <td className="px-3 py-2 text-slate-400 max-w-[180px] truncate" title={payment.note}>
                      {payment.note || "—"}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {confirmKey === payment._key ? (
                        <span className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleRemove(payment._key)}
                            disabled={removingKey !== null}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-500 text-white font-semibold hover:bg-rose-400 disabled:opacity-50"
                          >
                            {removingKey === payment._key && <LoaderCircle className="h-3 w-3 animate-spin" />}
                            Remove
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmKey(null)}
                            disabled={removingKey !== null}
                            className="px-2 py-1 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                          >
                            Keep
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmKey(payment._key)}
                          disabled={removingKey !== null}
                          aria-label={`Remove ${ALLOWANCE_TYPE_LABELS[payment.type]} payment of ${formatMoney(payment.amount, payment.currency)} on ${shortDate(payment.date)}`}
                          className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 disabled:opacity-50 transition-colors"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <form
        onSubmit={handleAdd}
        noValidate
        aria-label="Add allowance payment"
        className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-3"
      >
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Add payment</span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <label className="sr-only" htmlFor="allowance-type">
            Payment type
          </label>
          <select
            id="allowance-type"
            value={form.type}
            onChange={(event) => update("type", event.target.value as AllowanceType)}
            className={inputClassName()}
          >
            {ALLOWANCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {ALLOWANCE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="allowance-date">
            Payment date
          </label>
          <input
            id="allowance-date"
            type="date"
            value={form.date}
            onChange={(event) => update("date", event.target.value)}
            className={inputClassName()}
          />
          <label className="sr-only" htmlFor="allowance-amount">
            Amount
          </label>
          <input
            id="allowance-amount"
            type="text"
            inputMode="decimal"
            placeholder="Amount"
            value={form.amount}
            onChange={(event) => update("amount", event.target.value)}
            className={inputClassName()}
          />
          <label className="sr-only" htmlFor="allowance-currency">
            Currency
          </label>
          <select
            id="allowance-currency"
            value={form.currency}
            onChange={(event) => update("currency", event.target.value as Currency)}
            className={inputClassName()}
          >
            {CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <label className="sr-only" htmlFor="allowance-note">
            Note
          </label>
          <input
            id="allowance-note"
            type="text"
            maxLength={200}
            placeholder="Note (optional), e.g. week 3 pocket money"
            value={form.note}
            onChange={(event) => update("note", event.target.value)}
            className={inputClassName()}
          />
          <button
            type="submit"
            disabled={adding}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {adding ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {adding ? "Adding..." : "Add payment"}
          </button>
        </div>
        {error && (
          <div role="alert">
            <WarningBox tone="rose">{error}</WarningBox>
          </div>
        )}
      </form>
    </section>
  );
}
