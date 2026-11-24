# Paint catalogue sources

`miniature_paints.json`, with `additions.json`, is the source of ForgeLedger's paint catalogue: about 5,300 paints from 15 brands, each with its range, code, type and a colour. `scripts/make-catalogue.js` (`npm run catalogue`) turns it into `data/paint-catalogue.js`, which the app loads.

The colours are screen approximations of bottle swatches, not manufacturers' colour specifications. Washes, contrast paints, inks, glazes and metallics can't be shown by one flat colour, so treat theirs as a rough guide.

## Where the data comes from

- **Citadel:** [SimoGecko/CitadelColours](https://github.com/SimoGecko/CitadelColours), `tables/citadel_official_colors_table.md`, with colours from citadelcolour.com. The Arcturus5404 list below also has Citadel paints, but it lacks the newer Contrast paints and gives washes a mid-tone where this list gives their darkest colour, so this list is used.
- **The other 14 brands** (AK Interactive, AMMO by Mig, Coat d'Arms, Formula P3, Foundry, Green Stuff World, Kimera Kolors, Monument Hobbies (Pro Acryl), Reaper, Scale75, The Army Painter, Turbo Dork, Two Thin Coats and Vallejo): [Arcturus5404/miniature-paints](https://github.com/Arcturus5404/miniature-paints), the Miniature Painter Pro paint database, under the MIT licence in `LICENSE-miniature-paints.txt` (Copyright (c) 2022 Rick Fleuren).

## Additions

`additions.json` adds paints the sources above don't have yet, in the same format. Where no colour has been published, `hex` is null and the app shows no colour.

- **Two Thin Coats Dark Arts** (30 paints: 21 acrylics, 3 metallics, 6 inks): names from [Paint Vault's Dark Arts listing](https://www.paint-vault.com/brand/two-thin-coats/dark-arts), November 2026. No colours yet. One review calls a metallic "Ancient Brass" where Paint Vault has "Ancient Iron".

Paint and brand names belong to their manufacturers. ForgeLedger isn't connected with any of them.
