// Raid Service
// Verwaltung von Raids, Terminplanungen und Anmeldungen

import prisma from '../prisma';
import crypto from 'crypto';

export class RaidService {
    // Erstellt einen neuen Raid
    static async createRaid(guildId: number, data: any): Promise<any> {
        try {
            return await prisma.raid.create({
                data: {
                    guildId,
                    title: data.title,
                    description: data.description,
                    startTime: new Date(data.startTime),
                    endTime: data.endTime ? new Date(data.endTime) : null,
                    difficulty: data.difficulty || 'Normal',
                    maxPlayers: data.maxPlayers || 20,
                    recruitmentType: data.recruitmentType || 'everyone',
                    allowedRanks: data.allowedRanks || [],
                    recurringId: data.recurringId || null,
                    imageUrl: data.imageUrl || null,
                    status: 'scheduled',
                }
            });
        } catch (error) {
            console.error('Failed to create raid:', error);
            throw error;
        }
    }

    // Erstellt wiederkehrende Raids
    static async createRecurringRaids(guildId: number, template: any, weeks: number = 4): Promise<any[]> {
        const raids = [];
        const start = new Date(template.startTime);
        const recurringId = crypto.randomUUID?.() || Math.random().toString(36).substring(7);

        for (let i = 0; i < weeks; i++) {
            const raidDate = new Date(start);
            raidDate.setDate(start.getDate() + (i * 7));

            const raid = await this.createRaid(guildId, {
                ...template,
                startTime: raidDate.toISOString(),
                recurringId: i > 0 ? recurringId : null // Only set if it's part of a series
            });
            raids.push(raid);
        }
        return raids;
    }

    // Anmeldung für einen Raid
    static async signup(raidId: number, characterId: number, data: any): Promise<any> {
        try {
            return await prisma.attendance.upsert({
                where: {
                    raidId_characterId: {
                        raidId,
                        characterId
                    }
                },
                update: {
                    status: data.status, // attending, not_attending, late, tentative
                    comment: data.comment,
                    roleSlot: data.roleSlot || 'main', // main, twink1, twink2, twink3
                    isConfirmed: data.isConfirmed ?? undefined,
                    updatedAt: new Date(),
                },
                create: {
                    raidId,
                    characterId,
                    status: data.status,
                    comment: data.comment,
                    roleSlot: data.roleSlot || 'main',
                    isConfirmed: data.isConfirmed ?? false,
                }
            });
        } catch (error) {
            console.error('Failed to sign up for raid:', error);
            throw error;
        }
    }

    // Holt alle Raids einer Gilde inkl. Teilnehmern
    static async getGuildRaids(guildId: number): Promise<any[]> {
        return await prisma.raid.findMany({
            where: { guildId },
            include: {
                attendances: {
                    include: {
                        character: true
                    }
                }
            },
            orderBy: { startTime: 'asc' }
        });
    }
}
