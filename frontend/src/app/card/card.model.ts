// Everything that describes one card. This whole object is what gets saved to the backend.
export interface CardData {
  name: string;
  rarity: Rarity;
  frame: Frame;
  attribute: Attribute;
  /** Level, Rank or Negative Level, depending on the frame. */
  stars: number;
  monsterType: string;
  abilities: string[];
  /** Shows "Effect" at the end of the type line (for frames that can be either). */
  isEffect: boolean;
  atk: string;
  def: string;
  linkArrows: LinkArrow[];
  pendulum: boolean;
  leftScale: number;
  rightScale: number;
  pendulumText: string;
  spellType: SpellType;
  trapType: TrapType;
  text: string;
  /** Uploaded card art as a data URL, or '' for the placeholder. */
  art: string;
}

export const FRAMES = [
  'Normal', 'Effect', 'Ritual', 'Fusion', 'Synchro', 'Dark Synchro', 'Xyz', 'Link', 'Token',
  'Slifer', 'Obelisk', 'Ra', 'Spell', 'Trap', 'Legendary Dragon', 'Skill',
] as const;
export type Frame = (typeof FRAMES)[number];

export const FRAME_COLORS: Record<Frame, string> = {
  Normal: '#be9c67', Effect: '#ae6d50', Ritual: '#6686c4', Fusion: '#804d9f', Synchro: '#e8e8e8',
  'Dark Synchro': '#584d4d', Xyz: '#1a1a1a', Link: '#214b81', Token: '#6e6c6b', Slifer: '#bb4638',
  Obelisk: '#4343b3', Ra: '#ebc41b', Spell: '#458e83', Trap: '#b33689', 'Legendary Dragon': '#2d95b7',
  Skill: '#008dce',
};

export const RARITIES = [
  { id: 'Common', label: 'Common' },
  { id: 'Rare', label: 'Rare' },
  { id: 'Ultra-Rare', label: 'Ultra Rare' },
  { id: 'Secret-Rare', label: 'Secret Rare' },
  { id: 'Barian', label: 'Barian' },
  { id: 'Skills', label: 'Skill' },
] as const;
export type Rarity = (typeof RARITIES)[number]['id'];

export const ATTRIBUTES = ['Dark', 'Light', 'Earth', 'Water', 'Fire', 'Wind', 'Divine'] as const;
export type Attribute = (typeof ATTRIBUTES)[number];

export const MONSTER_TYPES = [
  'Aqua', 'Beast', 'Beast-Warrior', 'Creator God', 'Cyberse', 'Dinosaur', 'Divine-Beast', 'Dragon',
  'Fairy', 'Fiend', 'Fish', 'Illusion', 'Insect', 'Machine', 'Plant', 'Psychic', 'Pyro', 'Reptile',
  'Rock', 'Sea Serpent', 'Spellcaster', 'Thunder', 'Warrior', 'Winged Beast', 'Wyrm', 'Zombie',
];

export const ABILITIES = ['Tuner', 'Flip', 'Gemini', 'Spirit', 'Toon', 'Union'];

export const SPELL_TYPES = ['Normal', 'Quick-Play', 'Continuous', 'Equip', 'Field', 'Ritual'] as const;
export type SpellType = (typeof SPELL_TYPES)[number];

export const TRAP_TYPES = ['Normal', 'Continuous', 'Counter'] as const;
export type TrapType = (typeof TRAP_TYPES)[number];

// In the order they appear in a 3x3 grid (the middle cell is empty).
export const LINK_ARROWS = ['topLeft', 'top', 'topRight', 'left', 'right', 'bottomLeft', 'bottom', 'bottomRight'] as const;
export type LinkArrow = (typeof LINK_ARROWS)[number];

/** Frames that have a matching pendulum overlay image. */
const PENDULUM_FRAMES: Frame[] = ['Normal', 'Effect', 'Ritual', 'Fusion', 'Synchro', 'Xyz'];

/** Frames that appear in the type line, e.g. [Dragon/Synchro/Effect]. */
const TYPE_LINE_FRAMES: Frame[] = ['Ritual', 'Fusion', 'Synchro', 'Dark Synchro', 'Xyz', 'Link'];

export const isMonster = (frame: Frame) => !['Spell', 'Trap', 'Legendary Dragon', 'Skill'].includes(frame);
export const canBePendulum = (frame: Frame) => PENDULUM_FRAMES.includes(frame);
export const hasDef = (frame: Frame) => frame !== 'Link';

export type StarKind = 'level' | 'rank' | 'negativeLevel' | 'none';
export function starKind(frame: Frame): StarKind {
  if (!isMonster(frame) || frame === 'Link') return 'none';
  if (frame === 'Xyz') return 'rank';
  if (frame === 'Dark Synchro') return 'negativeLevel';
  return 'level';
}

/** Normal monsters have no "Effect" choice and Effect monsters always have it. */
export function effectChoice(frame: Frame): 'never' | 'always' | 'optional' {
  if (frame === 'Normal' || frame === 'Token') return 'never';
  if (frame === 'Effect') return 'always';
  return 'optional';
}

/** The parts of the type line, e.g. ['Dragon', 'Synchro', 'Pendulum', 'Tuner', 'Effect']. */
export function typeLine(card: CardData): string[] {
  const parts = [card.monsterType];
  if (TYPE_LINE_FRAMES.includes(card.frame)) parts.push(card.frame);
  if (card.pendulum && canBePendulum(card.frame)) parts.push('Pendulum');
  parts.push(...card.abilities);

  const effect = effectChoice(card.frame);
  if (effect === 'always' || (effect === 'optional' && card.isEffect)) {
    parts.push('Effect');
  } else if (card.frame === 'Normal' && parts.length > 1) {
    parts.push('Normal'); // e.g. [Dragon/Tuner/Normal]
  } else if (card.frame === 'Token') {
    parts.push('Token');
  }
  return parts;
}

export function newCard(): CardData {
  return {
    name: 'Dark Magician',
    rarity: 'Ultra-Rare',
    frame: 'Normal',
    attribute: 'Dark',
    stars: 7,
    monsterType: 'Spellcaster',
    abilities: [],
    isEffect: true,
    atk: '2500',
    def: '2100',
    linkArrows: [],
    pendulum: false,
    leftScale: 4,
    rightScale: 4,
    pendulumText: '',
    spellType: 'Normal',
    trapType: 'Normal',
    text: 'The ultimate wizard in terms of attack and defense.',
    art: '',
  };
}

/** Fills in any missing fields, so cards saved by older versions still load. */
export function normalizeCard(data: Partial<CardData>): CardData {
  return { ...newCard(), art: '', ...data };
}
