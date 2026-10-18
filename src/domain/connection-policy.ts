// Eligibility of the personal-use connection. The server validates the source
// again; a widget selection is never evidence of authorization.
export const PERSONAL_CONNECTOR_ID = 200;

export const MAX_PERSONAL_CONNECTIONS = 10;

export function isPersonalConnector(id: number | string | undefined) {
  return id === PERSONAL_CONNECTOR_ID || id === String(PERSONAL_CONNECTOR_ID);
}
