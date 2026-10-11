import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type TextFieldProps = React.ComponentProps<typeof Input> & {
  label: string;
  name: string;
  error?: string;
};

// A labelled input with its error, for the sign-in and sign-up forms
export function TextField({ label, name, error, ...input }: TextFieldProps) {
  return (
    <Field data-invalid={!!error || undefined}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        id={name}
        name={name}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        // Autofill and password-manager extensions restyle these inputs before React hydrates
        suppressHydrationWarning
        className="glass h-12 rounded-xl border-glass-border bg-glass-strong px-4 text-[17px] md:text-[17px] dark:bg-glass-strong"
        {...input}
      />
      {error && <FieldError id={`${name}-error`}>{error}</FieldError>}
    </Field>
  );
}
