import { Пауза, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ЗапуститьButton({
  onClick,
  disabled,
  label = "Запустить сейчас",
  size = "sm",
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  size?: "sm" | "default";
}) {
  return (
    <Button variant="outline" size={size} onClick={onClick} disabled={disabled}>
      <Play classИмя="h-3.5 w-3.5 sm:mr-1" />
      <span classИмя="hidden sm:inline">{label}</span>
    </Button>
  );
}

export function ПаузаПродолжитьButton({
  isПриостановлен,
  onПауза,
  onПродолжить,
  disabled,
  size = "sm",
}: {
  isПриостановлен: boolean;
  onПауза: () => void;
  onПродолжить: () => void;
  disabled?: boolean;
  size?: "sm" | "default";
}) {
  if (isПриостановлен) {
    return (
      <Button variant="outline" size={size} onClick={onПродолжить} disabled={disabled}>
        <Play classИмя="h-3.5 w-3.5 sm:mr-1" />
        <span classИмя="hidden sm:inline">Продолжить</span>
      </Button>
    );
  }

  return (
    <Button variant="outline" size={size} onClick={onПауза} disabled={disabled}>
      <Пауза classИмя="h-3.5 w-3.5 sm:mr-1" />
      <span classИмя="hidden sm:inline">Пауза</span>
    </Button>
  );
}
