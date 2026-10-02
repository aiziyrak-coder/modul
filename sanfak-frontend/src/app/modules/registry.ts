import type { ModuleManifest } from '@/shared/lib/module';

const manifestFiles = import.meta.glob<{ default: ModuleManifest }>(
  ['/src/modules/*/*.module.ts', '/src/modules/*/*.module.tsx'],
  { eager: true },
);

function folderOf(filePath: string): string {
  const match = filePath.match(/\/modules\/([^/]+)\//);
  return match?.[1] ?? '';
}

export interface RegisteredModule {
  file: string;
  folder: string;
  manifest: ModuleManifest;
}

function loadModules(): RegisteredModule[] {
  const loaded: RegisteredModule[] = [];
  const namespaces = new Map<string, string>();

  for (const [file, mod] of Object.entries(manifestFiles)) {
    const manifest = mod.default;
    if (!manifest) {
      throw new Error(`Module file ${file} does not default-export a manifest`);
    }
    const folder = folderOf(file);
    if (manifest.name !== folder) {
      throw new Error(
        `Module name "${manifest.name}" in ${file} must match folder "${folder}"`,
      );
    }
    const ns = (manifest.basePath ?? `/${folder}`).replace(/^\/+/, '');
    const claimed = namespaces.get(ns);
    if (claimed) {
      throw new Error(
        `Module namespace "/${ns}" is claimed by both ${claimed} and ${file}. ` +
          `Each module must own a unique URL prefix.`,
      );
    }
    namespaces.set(ns, file);
    loaded.push({ file, folder, manifest });
  }

  return loaded.sort((a, b) => a.folder.localeCompare(b.folder));
}

export const registeredModules: ReadonlyArray<RegisteredModule> = loadModules();
