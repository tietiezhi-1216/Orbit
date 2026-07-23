import { useEffect } from "react";
import { AutomationEditor } from "@/features/automations/automation-editor";
import { AutomationList } from "@/features/automations/automation-list";
import { useAutomationStore } from "@/stores/automations";

export function AutomationsPage() {
  const document = useAutomationStore((state) => state.document);
  const init = useAutomationStore((state) => state.init);

  useEffect(() => {
    void init();
  }, [init]);

  return document ? <AutomationEditor /> : <AutomationList />;
}
