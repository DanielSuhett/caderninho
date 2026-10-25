import { ConnectionWizardView } from "./connection-wizard-view";
import {
  type ConnectionWizardProps,
  useConnectionWizard,
} from "./use-connection-wizard";

export function ConnectionWizard(props: ConnectionWizardProps) {
  const model = useConnectionWizard(props);
  return <ConnectionWizardView model={model} />;
}
