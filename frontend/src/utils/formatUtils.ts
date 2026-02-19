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
/**
 * Returns the hex color for a WoW class ID or name string.
 */
export const getClassColor = (classIdOrName: number | string | null | undefined): string => {
    if (!classIdOrName) return '#D1D9E0';

    const colors: Record<number, string> = {
        1: '#C79C6E', // Warrior
        2: '#F58CBA', // Paladin
        3: '#ABD473', // Hunter
        4: '#FFF569', // Rogue
        5: '#FFFFFF', // Priest
        6: '#C41F3B', // Death Knight
        7: '#0070DE', // Shaman
        8: '#69CCF0', // Mage
        9: '#9482C9', // Warlock
        10: '#00FF96', // Monk
        11: '#FF7D0A', // Druid
        12: '#A330C9', // Demon Hunter
        13: '#33937F'  // Evoker
    };

    if (typeof classIdOrName === 'number') {
        return colors[classIdOrName] || '#D1D9E0';
    }

    const nameToId: Record<string, number> = {
        'warrior': 1, 'paladin': 2, 'hunter': 3, 'rogue': 4,
        'priest': 5, 'deathknight': 6, 'shaman': 7, 'mage': 8,
        'warlock': 9, 'monk': 10, 'druid': 11, 'demonhunter': 12,
        'evoker': 13
    };

    const normalized = classIdOrName.toLowerCase().replace(/\s+/g, '');
    const id = nameToId[normalized];
    return colors[id] || '#D1D9E0';
};
