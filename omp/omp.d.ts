// Types for the omp module index.ts imports at runtime. omp provides it, so nothing is installed for it.
declare module "@oh-my-pi/pi-coding-agent/extensibility/plugins/loader" {
  /** A plugin's saved settings: the user's plugin lockfile merged with the project's plugin overrides. */
  export function getPluginSettings(pluginName: string, cwd: string): Promise<Record<string, unknown>>
}
