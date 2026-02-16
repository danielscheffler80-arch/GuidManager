/**
 * Formats a WoW realm slug into a human-readable title-cased name.
 * e.g., "blackrock" -> "Blackrock", "die-silberne-hand" -> "Die Silberne Hand"
 */
export const formatRealm = (realm: string | null | undefined): string => {
    if (!realm) return 'Unbekannt';

    return realm
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
};

/**
 * Capitalizes a character name.
 * e.g., "xalliara" -> "Xalliara"
 */
export const capitalizeName = (name: string | null | undefined): string => {
    if (!name) return 'Unbekannt';
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
};
