import type { ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal } from "lucide-react";

export function RecordActions({
  label,
  disabled,
  actions,
}: {
  label: string;
  disabled?: boolean;
  actions: {
    label: string;
    icon: ReactNode;
    disabled?: boolean;
    destructive?: boolean;
    onSelect: () => void | Promise<void>;
  }[];
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="button row-action"
        aria-label={label}
        title={label}
        disabled={disabled}
      >
        <MoreHorizontal size={18} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="dropdown record-actions-menu"
          align="end"
          sideOffset={6}
          collisionPadding={12}
        >
          {actions.map((action) => (
            <DropdownMenu.Item
              key={action.label}
              disabled={action.disabled}
              className={
                action.destructive ? "record-action-danger" : undefined
              }
              onSelect={() => void action.onSelect()}
            >
              {action.icon}
              {action.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
