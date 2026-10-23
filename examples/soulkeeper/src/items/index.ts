/**
 * The item kit of Soulkeeper, for code: the item pieces drawn for their icons, the list of them
 * (`PIECE_ITEMS`) and the rarity tiers. The icon sheets read the kit through `catalog.ts` (`ITEMS`).
 * `gear.ts` and `loot.ts` are not re-exported here: they import the gear catalog, which imports the
 * characters' rigs; the shared helpers of `util.ts` stay inside the kit.
 */

export * from './amulet';
export * from './armor';
export * from './cloth';
export * from './coin';
export * from './flask';
export * from './keys';
export * from './scroll';
export * from './shard';
export * from './tome';
export * from './worn';
export * from './pieces';
export * from './rarity';
