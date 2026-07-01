export function isValidPositiveNumber(event: KeyboardEvent) {
  if (event.key.length === 1 && !/^\d$/.test(event.key) && !event.ctrlKey && !event.metaKey) {
    event.preventDefault();
  }
}
