import { useState, useEffect, useCallback } from 'react';
import { GuildService } from '../api/guildService';
import { CharacterService } from '../api/characterService';

export function usePreferredGuild() {
    const [guilds, setGuilds] = useState<any[]>([]);
    const [selectedGuild, setSelectedGuild] = useState<any>(null);
    const [myCharacters, setMyCharacters] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const init = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Fetch Guilds
            const gData = await GuildService.getGuilds();
            const allGuilds = gData.guilds || [];
            console.log('[usePreferredGuild] Guilds loaded:', allGuilds.length);
            setGuilds(allGuilds);

            // 2. Fetch Characters to find Main
            const cData = await CharacterService.getMyCharacters();
            const allChars = cData.user?.characters || cData.characters || [];
            console.log('[usePreferredGuild] Characters loaded:', allChars.length);
            setMyCharacters(allChars);

            if (allGuilds.length === 0) {
                setLoading(false);
                return;
            }

            const mainChar = allChars.find((c: any) => c.isMain);
            const mainGuildId = mainChar?.guildId;

            // 3. Check Session Persistence
            const savedGuildId = localStorage.getItem('selectedGuildId');

            console.log('[usePreferredGuild] Decision context:', {
                mainGuildId,
                savedGuildId,
                firstGuildId: allGuilds[0]?.id
            });

            // Priority: 1. Main Char Guild (if first time or match), 
            // 2. Persisted Guild (if manual override exists), 
            // 3. First Guild

            // Note: We prioritize Main Guild OVER localStorage if it's the very first load 
            // of the app session or if no override is set.
            const preferredId = mainGuildId ? String(mainGuildId) : (savedGuildId ? String(savedGuildId) : null);
            const preferredGuild = allGuilds.find((g: any) => String(g.id) === preferredId);

            const finalGuild = preferredGuild || allGuilds[0];
            setSelectedGuild(finalGuild);

            // Persist if we decided on a main guild for the first time
            if (mainGuildId && !savedGuildId) {
                localStorage.setItem('selectedGuildId', String(mainGuildId));
            }

        } catch (err: any) {
            console.error('[usePreferredGuild] Error:', err);
            setError(err.message || 'Failed to initialize guild selection');
        } finally {
            setLoading(false);
        }
    }, []);

    const changeSelectedGuild = useCallback((guild: any) => {
        setSelectedGuild(guild);
        if (guild?.id) {
            localStorage.setItem('selectedGuildId', String(guild.id));
        }
    }, []);

    useEffect(() => {
        init();
    }, [init]);

    return {
        guilds,
        selectedGuild,
        setSelectedGuild: changeSelectedGuild,
        myCharacters,
        loading,
        error,
        refresh: init
    };
}
