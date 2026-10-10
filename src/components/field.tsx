import type { InputHTMLAttributes } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  errors?: string[];
};

export function Field({ label, name, errors, ...input }: FieldProps) {
  const errorId = errors?.length ? `${name}-error` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        aria-invalid={!!errorId}
        aria-describedby={errorId}
        className="w-full rounded-md border border-rule bg-sheet px-3 py-2.5 text-[15px] outline-none transition-colors placeholder:text-ink-soft/60 focus:border-pen aria-invalid:border-danger"
        {...input}
      />
      {errorId && (
        <p id={errorId} className="text-sm text-danger">
          {errors![0]}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-ink px-4 py-2.5 text-[15px] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {children}
    </button>
  );
}
