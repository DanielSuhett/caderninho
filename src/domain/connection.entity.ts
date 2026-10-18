// The source validates the personal-use connector selected by the widget.
export const PERSONAL_CONNECTOR_ID = 200;

export const MAX_PERSONAL_CONNECTIONS = 10;

export function assertPersonalConnector(id: number | string | undefined) {
  if (id !== PERSONAL_CONNECTOR_ID && id !== String(PERSONAL_CONNECTOR_ID)) {
    throw new Error("MEU_PLUGGY_REQUIRED");
  }
}

export function assertConnectionCapacity({
  count,
  exists,
}: {
  count: number;
  exists: boolean;
}) {
  if (count >= MAX_PERSONAL_CONNECTIONS && !exists) {
    throw new Error("ITEM_LIMIT");
  }
}
