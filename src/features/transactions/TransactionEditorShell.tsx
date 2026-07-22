import React from "react";
import { MobileFormShell } from "../../components/mobile/MobileFormShell";

type TransactionEditorShellProps = {
  isKeyboardEditing: boolean;
  mode: 'add' | 'edit';
  activeTab: 'income' | 'expense' | 'billing';
  billingDocType: 'invoice' | 'estimate';
  tabSelector?: React.ReactNode;
  utilityPanel?: React.ReactNode;
  formContent: React.ReactNode;
};

export function TransactionEditorShell({ isKeyboardEditing, mode, activeTab, billingDocType, tabSelector, utilityPanel, formContent }: TransactionEditorShellProps) {
  const noun = activeTab === 'billing' ? (billingDocType === 'estimate' ? 'estimate' : 'invoice') : activeTab;
  const description = mode === 'add'
    ? `Create a new ${noun} entry in a single keyboard-safe editing flow.`
    : `Update this ${noun} entry without the drawer fighting iPhone keyboard behavior.`;

  return (
    <MobileFormShell
      isEditing={isKeyboardEditing}
      title={mode === 'add' ? 'New entry' : 'Edit entry'}
      description={description}
      toolbar={!isKeyboardEditing ? tabSelector : undefined}
      form={
        <div className="space-y-6">
          {utilityPanel && !isKeyboardEditing ? utilityPanel : null}
          {formContent}
        </div>
      }
      className="border-0 shadow-none bg-transparent dark:bg-transparent p-0 sm:p-0"
    />
  );
}
