import type { Slot } from '@core/rig';

export const SLOT_LABELS: Record<Slot, string> = {
  head: 'Cabeça',
  chest: 'Peito',
  pelvis: 'Cintura',
  back: 'Costas',
  shoulder: 'Ombro',
  upperArm: 'Braço',
  forearm: 'Antebraço',
  hand: 'Mão',
  thigh: 'Coxa',
  shin: 'Canela',
  foot: 'Pé',
};

export const SIDE_LABELS = { 1: 'Direita', [-1]: 'Esquerda' } as const;

const GROUP_LABELS: Record<string, string> = {
  head: 'Cabeça',
  shoulders: 'Ombros',
  torso: 'Torso',
  garments: 'Roupas',
  weapons: 'Armas',
  shields: 'Escudos',
  effects: 'Efeitos',
  bodies: 'Corpos',
};

/** The picker's group names are the kit's ids ('weapons'); show them in Portuguese, and any new one as written. */
export const groupLabel = (group: string) => GROUP_LABELS[group] ?? group.charAt(0).toUpperCase() + group.slice(1);

/** Material roles read as words ('metalAccent' → 'metal accent'); the id stays what the kit calls it. */
export const roleLabel = (role: string) => role.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
