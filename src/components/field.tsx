import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FieldProps = React.ComponentProps<typeof Input> & {
  label: string;
  name: string;
  errors?: string[];
  /** Keep the label for screen readers only; the placeholder carries it visually. */
  hideLabel?: boolean;
};

export function Field({ label, name, errors, hideLabel, ...input }: FieldProps) {
  const errorId = errors?.length ? `${name}-error` : undefined;
  return (
    <div className="grid gap-2">
      <Label htmlFor={name} className={hideLabel ? "sr-only" : undefined}>
        {label}
      </Label>
      <Input
        id={name}
        name={name}
        aria-invalid={!!errorId}
        aria-describedby={errorId}
        placeholder={hideLabel ? label : undefined}
        className="h-11 px-4 text-[15px] md:text-[15px]"
        {...input}
      />
      {errorId && (
        <p id={errorId} className="text-left text-sm text-destructive">
          {errors![0]}
        </p>
      )}
    </div>
  );
}
