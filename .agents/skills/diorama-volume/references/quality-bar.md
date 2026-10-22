# Quality bar for volume assets

The project owner chooses the style: palette, ramps, line widths, form shading, contour, camera. These rules do not pick a style. They are the floor every style must clear, because they decide whether an asset reads as finished art or as a mannequin. Numbers marked *convention* come from practice. `npm run inspect -- <png>` measures the four numbers marked *Measured* below (value spread and tone levels in rule 1, ink share in rule 2, accent share in rule 3) and prints warnings that name the fix. The detail tiers of rule 4 are not measured.

## What the engine already does (do not fight it)

- **Form shading:** every round part (`Round`, `Tube`, `Blob`) gets three tones. They are a core shadow away from the light, the base tone, and a highlight along the lit edge. Each band is a crescent of the silhouette, so a finger and a torso both read. The theme tunes it per material with `VolumeStyle.form`, for example `highlight: false` for matte cloth or a stronger highlight for metal. Leave it at the defaults unless the style asks otherwise.
- **Line hierarchy:** the theme's `Camera` sets one `contour` that inks the whole silhouette of every stage object. The `stroke` of each material is the line *between* parts. Every project keeps the hierarchy: contour heavier than inner lines.
- **Faceted solids:** they take their three tones from face normals and ink their creases.

## Rules

1. **Three readable tones per material, distinct values between neighbors.**
   - Every material ramp has a clearly darker `dark` and a clearly lighter `lit`.
   - Adjacent materials (bone next to cloth, fur next to the pale chest) differ in value, not only in hue.
   - *Measured:* `value spread ≥ 0.3`, `tone levels ≥ 5`.
2. **Lines support the form, they don't replace it.**
   - Inner lines are a dark shade of their own material (selective outline: `lerpColor(ramp.dark, ink, ~0.6)`), not black, and thinner than the contour.
   - A part thinner than about three line widths gets a thinner line, or none.
   - Hollows (mouths, rib cages, sockets, the inside of ears) use a dark *color* (a `hollow` token), not ink.
   - *Measured:* `ink ≤ 30%` of the opaque pixels.
3. **One focal accent.**
   - A small saturated color marks where the eye goes: eyes, a gem, a flame, runes on a blade.
   - Use the ramp's saturated `base` with a pale core; a pale `lit` alone does not saturate.
   - *Measured:* `accent > 0` and `≤ 20%`.
4. **Detail in three tiers.** *Convention*, with minimums for a character or a hero prop:
   - **Primary, at least 2:** what makes the silhouette, recognizable in every facing. Examples: a helm with horns, a shield, a weapon, a mane, a crest.
   - **Secondary, at least 4:** material breakup that tells the story. Examples: belt, straps, tabard, bracer, greave, pale belly, torn flank.
   - **Tertiary, at least 4:** small marks seen up close. Examples: rivets, teeth, runes, plank seams, wraps, fangs.
   - A small prop needs fewer, but never zero secondary.
5. **No mannequin shapes.**
   - No egg heads: give skulls a jaw, a face plane, sockets, and a helm or hair.
   - No pin limbs: at the export size, limbs are at least about 3 exported px (1.5 logical px at scale 2) wide, measured as the full width (the `width` of a `Tube` is the full width in logical px, not a radius). Add knobs at the joints and masses at the haunches or shoulders.
   - No single convex blob for a body: use a `Blob` of masses so the waist and neck tuck in.
   - Cloth hems are torn or shaped, not a clean ellipse.
6. **A ragged silhouette where the material is ragged.**
   - Fur, torn cloth and foliage break the outline with tufts, notches or strips.
   - Sort clumps by depth when they should cover the body. Use `bias` far behind the body when only their tips should poke out.
7. **The right sorting for each attachment.**
   - `on` is for things that are always over their host from every side: a buckle on a belt, a candle on a lid, a boss on a shield seen from the front.
   - Things on one side of a body (a nasal bar, a chest bib, a front tabard, a shield strapped outside the arm) are sorted by depth, or switched with `cam.faces(normal)`. With `on`, they would show through the body when it turns away.
   - Bands around a body (belts, bracelets, ribs, hoops) use `visibleArc`, so the back half never crosses the front.
8. **Cheap per frame.**
   - Skins and assets never call shape booleans (`union`, `subtract`, `intersect`) per part per frame. The engine paints form with canvas clipping for this reason.
   - *Convention:* stay under about 30 ms per cell. A character sheet has 64–96 cells and the export has a 15 s budget per asset.

## Scenery

Scenery sits under the actors, so some numbers change (guide 04 §6):
- **Floors** read calmer than the characters on them: lower contrast, smaller details, no accent of their own. `inspect` judges floor tile sheets (`role: tile`) on a value spread from 0.12 to 0.45 and at least 4 tone levels.
  - A field of one floor must not show a repeating lattice or motif at 1× (`npm run scenery-test -- <p> <floor> --field`): 4–6 variants, soft large features sized to the room they have, small details on `t.spread`, and a distinctive motif (a skull, a bone, a ripple) in one or two variants only.
  - Details stay under about 8 px; a floor's own glow (glints on water) has cores under a pixel, a few per tile.
- **Decals** are quiet marks; an accent is optional.
- **Scale against the characters** comes from the project's space profile (`src/space.ts`, guide 04 §1): walls, doors and fences take its sizes, props are sized against `SPACE.scale.character`, and `inspect` warns about off-scale sheets. Judge every kit piece next to a scale figure (`scenery-test`) before calling it done.
- **Walls, fences and props** follow every rule above. Their detail tiers are those of a small prop, and the accent stays rare, so a gate's lantern or a brazier reads as the focal point.

## Review loop

1. Export, then run `npm run inspect -- <png>`. Fix every warning or say why it does not apply.
2. Run `npm run contact -- <png>` and `--gray`. Look at every row at the export size, then zoom the weak rows and frames with `--rows ... --frames ... --zoom 3`.
3. Compare it side by side with one finished asset of the project (`npm run contact -- <png> --with <other.png>`; add `--zoom N` when the cells differ in size). It must look like it belongs to the same game and to the same level of finish.
4. Name the primary, secondary and tertiary details you added in the report. If a tier is short, the asset is not done.
