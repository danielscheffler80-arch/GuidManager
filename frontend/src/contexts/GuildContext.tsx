import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { GuildService } from '../api/guildService';
import { CharacterService } from '../api/characterService';
import { useAuth } from './AuthContext';

interface Guild {
    id: number;
    name: string;
    realm: string;
    faction: string;
    icon?: string;
}

interface GuildContextType {
    guilds: Guild[];
    selectedGuild: Guild | null;
    setSelectedGuild: (guild: Guild | null) => void;
    selectedRosterView: string;
    setSelectedRosterView: (view: string) => void;
    availableRosters: any[];
    myCharacters: any[];
    loading: boolean;
    isRosterSyncing: boolean;
    lastRosterSyncAt: number;
    triggerRosterSync: (guildId: number) => Promise<void>;
    settingsSortField: 'ilvl' | 'rio' | 'progress';
    setSettingsSortField: (field: 'ilvl' | 'rio' | 'progress') => void;
    rosterSortField: 'role' | 'ilvl' | 'rank';
    setRosterSortField: (field: 'role' | 'ilvl' | 'rank') => void;
    error: string | null;
    refresh: () => Promise<void>;
    refreshRosters: () => Promise<void>;
}

const GuildContext = createContext<GuildContextType | undefined>(undefined);

export const GuildProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [guilds, setGuilds] = useState<Guild[]>([]);
    const [selectedGuild, setSelectedGuild] = useState<Guild | null>(null);
    const [selectedRosterView, setSelectedRosterView] = useState<string>('all');
    const [availableRosters, setAvailableRosters] = useState<any[]>([]);
    const [myCharacters, setMyCharacters] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRosterSyncing, setIsRosterSyncing] = useState(false);
    const [lastRosterSyncAt, setLastRosterSyncAt] = useState<number>(0);
    const [settingsSortField, setSettingsSortField] = useState<'ilvl' | 'rio' | 'progress'>('ilvl');
    const [rosterSortField, setRosterSortField] = useState<'role' | 'ilvl' | 'rank'>('role');
    const [error, setError] = useState<string | null>(null);

    const triggerRosterSync = useCallback(async (guildId: number) => {
        if (isRosterSyncing) return;
        setIsRosterSyncing(true);
        try {
            await GuildService.syncMembers(guildId);
            setLastRosterSyncAt(Date.now());
        } catch (err) {
            console.error('[GuildContext] Roster sync failed:', err);
        } finally {
            setIsRosterSyncing(false);
        }
    }, [isRosterSyncing]);

    const init = useCallback(async () => {
        if (!user) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            // 1. Fetch Guilds
            const gData = await GuildService.getGuilds();
            const filteredGuilds = gData.guilds || [];

            setGuilds(filteredGuilds);

            // 2. Fetch Characters to find Main
            const cData = await CharacterService.getMyCharacters();
            const allChars = cData.user?.characters || cData.characters || [];
            setMyCharacters(allChars);

            if (filteredGuilds.length === 0) {
                setLoading(false);
                return;
            }

            const mainChar = allChars.find((c: any) => c.isMain);
            const mainGuildId = mainChar?.guildId;

            // 3. Check Session Persistence
            const savedGuildId = localStorage.getItem('selectedGuildId');

            // Priority: 1. Main Char Guild (if first time), 2. Persisted Guild, 3. First Guild
            const preferredId = mainGuildId ? String(mainGuildId) : (savedGuildId ? String(savedGuildId) : null);
            const preferredGuild = filteredGuilds.find((g: any) => String(g.id) === preferredId);

            const finalGuild = preferredGuild || filteredGuilds[0];
            setSelectedGuild(finalGuild);

            if (finalGuild) {
                const rData = await GuildService.getRosters(finalGuild.id);
                setAvailableRosters(rData.rosters || []);
            }

            if (mainGuildId && !savedGuildId) {
                localStorage.setItem('selectedGuildId', String(mainGuildId));
            }

        } catch (err: any) {
            console.error('[GuildContext] Error:', err);
            setError(err.message || 'Failed to initialize guild selection');
        } finally {
            setLoading(false);
        }
    }, [user]);

    const refreshRosters = useCallback(async () => {
        if (!selectedGuild) return;
        try {
            const rData = await GuildService.getRosters(selectedGuild.id);
            const rosters = rData.rosters || [];
            setAvailableRosters(rosters);

            // Falls das aktuelle Roster gelöscht wurde, auf 'all' zurücksetzen
            if (selectedRosterView !== 'all' && selectedRosterView !== 'main') {
                const stillExists = rosters.find((r: any) => String(r.id) === String(selectedRosterView));
                if (!stillExists) {
                    setSelectedRosterView('all');
                }
            }
        } catch (err) {
            console.error('[GuildContext] Refresh rosters failed:', err);
        }
    }, [selectedGuild, selectedRosterView]);

    const changeSelectedGuild = (guild: Guild | null) => {
        setSelectedGuild(guild);
        if (guild?.id) {
            localStorage.setItem('selectedGuildId', String(guild.id));
        } else {
            localStorage.removeItem('selectedGuildId');
        }
    };

    useEffect(() => {
        init();
    }, [init]);

    // Neu: Lade die Roster nach, sobald die Gilde im Dropdown gewechselt wird
    useEffect(() => {
        if (selectedGuild?.id) {
            refreshRosters();
        } else {
            setAvailableRosters([]);
            setSelectedRosterView('all');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedGuild?.id]);

    return (
        <GuildContext.Provider value={{
            guilds,
            selectedGuild,
            setSelectedGuild: changeSelectedGuild,
            selectedRosterView,
            setSelectedRosterView,
            availableRosters,
            myCharacters,
            loading,
            isRosterSyncing,
            lastRosterSyncAt,
            triggerRosterSync,
            settingsSortField,
            setSettingsSortField,
            rosterSortField,
            setRosterSortField,
            error,
            refresh: init,
            refreshRosters
        }}>
            {children}
        </GuildContext.Provider>
    );
};

export const useGuild = () => {
    const context = useContext(GuildContext);
    if (context === undefined) {
        throw new Error('useGuild must be used within a GuildProvider');
    }
    return context;
};
