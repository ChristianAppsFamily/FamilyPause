/**
 * Shared Monthly / Yearly pill used by Paywall and Settings.
 * @param {{ value: string, onChange: (next: string) => void, disabled?: boolean, monthlyValue?: string, annualValue?: string, annualLabel?: string }} props
 */
export default function BillingPeriodToggle({
  value,
  onChange,
  disabled = false,
  monthlyValue = "monthly",
  annualValue = "annual",
  annualLabel = "Yearly",
  className = "",
}) {
  return (
    <div className={"billing-period" + (className ? ` ${className}` : "")} role="group" aria-label="Billing period">
      <button
        type="button"
        className={value === monthlyValue ? "on" : ""}
        aria-pressed={value === monthlyValue}
        disabled={disabled}
        onClick={() => onChange(monthlyValue)}
      >
        Monthly
      </button>
      <button
        type="button"
        className={value === annualValue ? "on" : ""}
        aria-pressed={value === annualValue}
        disabled={disabled}
        onClick={() => onChange(annualValue)}
      >
        {annualLabel}
      </button>
    </div>
  );
}
