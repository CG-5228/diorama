# Projects

Your own projects go here, one folder each. Diorama does not version them: everything in this folder except this README is ignored by its git repository, so a project can be a git repository of its own.

Create one with `npm run new-project -- <name>` (`--style` adds STYLE.md, `--genre <preset>` the space profile). It starts with the layout of [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md):

```
projects/<name>/
├── STYLE.md      art direction (optional)
├── src/          hand-written code: theme.ts, space.ts, characters/, kits; nothing here is exported by itself
├── sheets/       one thin file per exported sheet, importing from src/
├── assets/       exported PNG + atlas JSON, mirroring sheets/ (generated)
└── review/       contact sheets, scenery tests, mockups (scratch, ignored by the project's .gitignore)
```

Commands and the viewer find a project by name here first, then in `examples/`, so a project here hides an example of the same name. `npm run check -- <name>` type-checks it and checks its layout.

The sample, `examples/pivot-v2-2d`, shows every kind of asset in this layout; `npm run example` exports it.
