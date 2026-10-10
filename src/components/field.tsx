import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FieldProps = React.ComponentProps<typeof Input> & {
  label: string;
  name: string;
  errors?: string[];
};

export function Field({ label, name, errors, ...input }: FieldProps) {
  const errorId = errors?.length ? `${name}-error` : undefined;
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-invalid={!!errorId}
        aria-describedby={errorId}
        className="h-10 px-3"
        {...input}
      />
      {errorId && (
        <p id={errorId} className="text-sm text-destructive">
          {errors![0]}
        </p>
      )}
    </div>
  );
}
