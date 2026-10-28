// "/" jumps to the page search unless the person is already typing somewhere.
export function isSearchShortcut(event: {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  target: EventTarget | null;
}) {
  if (event.key !== "/" || event.altKey || event.ctrlKey || event.metaKey) {
    return false;
  }
  const { target } = event;
  if (!target || typeof HTMLElement === "undefined") {
    return true;
  }
  if (!(target instanceof HTMLElement)) {
    return true;
  }
  return !(
    target.isContentEditable ||
    target.closest("input, textarea, select, [role='dialog']")
  );
}

export function focusPageSearch(root: ParentNode = document) {
  const field = root.querySelector<HTMLInputElement>(
    "main input[type='search']:not(:disabled)",
  );
  if (!field) {
    return false;
  }
  field.focus();
  field.select();
  return true;
}
