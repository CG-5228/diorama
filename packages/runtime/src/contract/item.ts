/** What an item icon's sheet says about the item (`meta.data.item`, role 'icon'). */
export interface ItemMeta {
  id: string;
  label: string;
  kind: string;
  rarity: string;
  rarityLabel?: string;
  rarityColor?: string;
  stack?: number;
  description?: string;
  /** The gear part the item equips: the part's id in the gear catalog. */
  gear?: string;
  /** That part's equipment slot, when the gear catalog gives the part one. */
  equip?: string;
}
