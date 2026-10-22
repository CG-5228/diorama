/** The rules of a character's name (and its folder): lowercase letters and digits, joined by single dashes. */
export const isValidCharacterName = (name: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name);
